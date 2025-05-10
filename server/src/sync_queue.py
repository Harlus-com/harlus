import asyncio
import threading
from typing import Callable

from src.tool_library import ToolLibrary
from src.stream_manager import StreamManager

from src.file_store import File, FileStore
from src.sync_status import SyncStatus
from harlus_doc_search import DocToolLoader
from harlus_contrast_tool import (
    ClaimQueryEngineToolLoader,
    VerdictQueryEngineToolLoader,
    SentenceRetrieverToolLoader,
)

loaders = [
    DocToolLoader(),
    ClaimQueryEngineToolLoader(),
    VerdictQueryEngineToolLoader(),
    SentenceRetrieverToolLoader(),
]


loaders_by_name = {loader.get_tool_name(): loader for loader in loaders}


MAX_CONCURRENT = 100

from enum import Enum


class SyncType(Enum):
    FORCE = 0
    NORMAL = 1


class SyncRequest:
    def __init__(self, file: File, sync_type: SyncType):
        self.file = file
        self.sync_type = sync_type

    def __str__(self):
        return f"SyncRequest(file={self.file.id}, sync_type={self.sync_type})"


class SyncTask:
    def __init__(self, sync_request: SyncRequest, tools: list[str]):
        self.sync_request = sync_request
        self.lock = threading.Lock()
        self.tool_syncs: dict[str, SyncStatus] = {
            tool_name: SyncStatus.SYNC_IN_PROGRESS for tool_name in tools
        }

    def mark_complete(self, tool_name: str):
        with self.lock:
            self.tool_syncs[tool_name] = SyncStatus.SYNC_COMPLETE

    def mark_error(self, tool_name: str):
        with self.lock:
            self.tool_syncs[tool_name] = SyncStatus.SYNC_ERROR

    def is_complete(self) -> bool:
        with self.lock:
            return all(
                status != SyncStatus.SYNC_IN_PROGRESS
                for status in self.tool_syncs.values()
            )

    def get_status(self) -> SyncStatus:
        if not self.is_complete():
            return SyncStatus.SYNC_IN_PROGRESS
        with self.lock:
            if all(
                status == SyncStatus.SYNC_COMPLETE
                for status in self.tool_syncs.values()
            ):
                return SyncStatus.SYNC_COMPLETE
            return SyncStatus.SYNC_ERROR

    def __str__(self):
        with self.lock:
            tool_to_status = {t: self.tool_syncs[t].value for t in self.tool_syncs}
            return f"SyncTask(file={self.sync_request.file.absolute_path}, tools={tool_to_status})"


class SyncQueue:
    def __init__(
        self,
        stream_manager: StreamManager,
        file_store: FileStore,
        tool_library: ToolLibrary,
    ):
        self.stream_manager = stream_manager
        self.file_store = file_store
        self.tool_library = tool_library
        self.sync_queue: asyncio.Queue[SyncRequest] = asyncio.Queue()
        self.sync_status: dict[str, SyncStatus] = {}  # File ID -> SyncStatus
        self.lock = threading.Lock()
        self.worker_task = None
        self.callbacks: set[Callable[[File, SyncStatus], None]] = set()

    async def queue_model_sync(self, file: File, sync_type: SyncType = SyncType.NORMAL):
        """Add a file to the sync queue"""
        with self.lock:
            sync_status = self.sync_status.get(file.id, SyncStatus.UNKNOWN)
            if (
                sync_status == SyncStatus.SYNC_IN_PROGRESS
                or sync_status == SyncStatus.SYNC_PENDING
            ):
                print(f"Sync of file {file.id} is already in progress")
                return False
            await self._set_sync_status(file, SyncStatus.SYNC_PENDING)
            # If the queue is full, wait for it to be processed
            # Note: This is not a limit of ten items, but rather an internal limit of the asyncio queue
            await self.sync_queue.put(SyncRequest(file, sync_type))

            if self.worker_task is None:
                self.worker_task = asyncio.create_task(self._worker())

    def get_sync_status(self, file_id: str) -> SyncStatus:
        """Get the sync status of a file"""
        with self.lock:
            return self.sync_status.get(file_id, SyncStatus.UNKNOWN)

    def register_callback(self, callback: Callable[[File, SyncStatus], None]):
        """Register a callback to be called when a file sync status changes"""
        with self.lock:
            self.callbacks.add(callback)
        return callback

    def unregister_callback(self, callback: Callable[[File, SyncStatus], None]):
        """Unregister a callback for a file"""
        with self.lock:
            self.callbacks.discard(callback)

    async def _worker(self):
        """Worker that processes the sync queue"""
        active_tasks = set()
        while not self.sync_queue.empty():
            sync_request = await self.sync_queue.get()
            tools_to_sync = self._get_tools_to_sync(sync_request)
            if len(tools_to_sync) == 0:
                # Sleep to simulate a load. This creates for better UI experience
                await asyncio.sleep(0.2)
                self.sync_queue.task_done()
                await self._set_sync_status(sync_request.file, SyncStatus.SYNC_COMPLETE)
                continue

            if len(active_tasks) >= MAX_CONCURRENT - len(tools_to_sync):
                await asyncio.wait(active_tasks, return_when=asyncio.FIRST_COMPLETED)
                continue

            sync_task = SyncTask(sync_request, tools_to_sync)

            for tool_name in tools_to_sync:
                await self._set_sync_status(
                    sync_request.file, SyncStatus.SYNC_IN_PROGRESS
                )
                task = asyncio.create_task(self._sync_tool(sync_task, tool_name))
                active_tasks.add(task)
                task.add_done_callback(active_tasks.discard)
        with self.lock:
            self.worker_task = None

    def _get_tools_to_sync(self, sync_request: SyncRequest) -> list[str]:
        """Get the tools to sync for a file"""
        with self.lock:
            if sync_request.sync_type == SyncType.FORCE:
                return [tool_name for tool_name in loaders_by_name]
            if self.sync_status[sync_request.file.id] == SyncStatus.SYNC_COMPLETE:
                return []
            return [
                tool_name
                for tool_name in loaders_by_name
                if not self.tool_library.has_tool(
                    sync_request.file.absolute_path, tool_name
                )
            ]

    async def _sync_tool(self, sync_task: SyncTask, tool_name: str):
        """Sync a single tool"""
        file = sync_task.sync_request.file
        try:
            loader = loaders_by_name[tool_name]
            print(f"Loading tool {tool_name} for file {file.name}")
            tool_wrapper = await loader.load(file.absolute_path, file.name)
            print(f"Tool {tool_name} loaded for file {file.name}")
            self.tool_library.add_tool(
                file.absolute_path,
                tool_wrapper,
                overwrite=sync_task.sync_request.sync_type == SyncType.FORCE,
            )
            sync_task.mark_complete(tool_name)
        except Exception as e:
            print(f"Error syncing file {file.id}: {e}")
            sync_task.mark_error(tool_name)
        finally:
            if sync_task.is_complete():
                print(f"Sync task {sync_task} is complete")
                await self._set_sync_status(file, sync_task.get_status())

    async def _set_sync_status(self, file: File, status: SyncStatus):
        """Set the sync status of a file"""
        self.sync_status[file.id] = status
        for callback in self.callbacks:
            asyncio.create_task(callback(file, status))
