import asyncio
from collections import defaultdict
import threading
from typing import Callable
import traceback

from src.tool_library import ToolLibrary, ToolSyncStatus

from src.file_store import File, FileStore
from src.sync_status import SyncStatus
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


class SyncQueue:
    def __init__(
        self,
        file_store: FileStore,
        tool_library: ToolLibrary,
    ):
        self.file_store = file_store
        self.tool_library = tool_library
        self.sync_queue: StatusTrackingQueue = StatusTrackingQueue()
        self.file_to_active_tool_syncs: dict[str, set[asyncio.Task]] = defaultdict(set)
        self.lock = threading.Lock()
        self.worker_task = None
        self.callbacks: set[Callable[[File, SyncStatus], None]] = set()

    async def queue_model_sync(self, file: File, sync_type: SyncType = SyncType.NORMAL):
        """Add a file to the sync queue"""
        with self.lock:
            if self.sync_queue.is_pending(file.id):
                print(f"Sync of file {file.id} is pending")
                return False
            if len(self.file_to_active_tool_syncs[file.id]) > 0:
                print(f"Sync of file {file.id} is already in progress")
                return False
            await self.sync_queue.put(SyncRequest(file, sync_type))
            if self.worker_task is None:
                self.worker_task = asyncio.create_task(self._worker())

    def get_sync_status(self, file_id: str) -> SyncStatus:
        """Get the sync status of a file"""
        with self.lock:
            return self._get_sync_status(file_id)

    def _get_sync_status(self, file_id: str) -> SyncStatus:
        if self.sync_queue.is_pending(file_id):
            return SyncStatus.SYNC_PENDING
        if self.file_to_active_tool_syncs[file_id]:
            return SyncStatus.SYNC_IN_PROGRESS
        tool_statuses = self.tool_library.get_last_sync_status(file_id).values()
        if all(status == ToolSyncStatus.SUCCESS for status in tool_statuses):
            return SyncStatus.SYNC_COMPLETE
        if all(status == ToolSyncStatus.NONE for status in tool_statuses):
            return SyncStatus.UNKNOWN
        if all(status == ToolSyncStatus.ERROR for status in tool_statuses):
            return SyncStatus.SYNC_ERROR
        if any(status == ToolSyncStatus.NONE for status in tool_statuses):
            return SyncStatus.SYNC_INCOMPLETE
        return SyncStatus.SYNC_PARTIAL_SUCCESS

    def _get_mixed_status(self, tool_statuses: list[SyncStatus]) -> SyncStatus:
        if any(status == SyncStatus.SYNC_ERROR for status in tool_statuses):
            return SyncStatus.SYNC_ERROR
        return SyncStatus.SYNC_INCOMPLETE

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
        print("Worker is running")
        while not self.sync_queue.is_empty():
            try:
                sync_request = await self.sync_queue.get()
                tools_to_sync = self.tool_library.get_tools_to_sync(sync_request.file)
                if len(tools_to_sync) == 0:
                    self.sync_queue.mark_no_op(sync_request)
                    for tool_name in self.tool_library.all_tool_names():
                        self.tool_library.write_sync_status(
                            sync_request.file,
                            tool_name,
                            ToolSyncStatus.SUCCESS,
                            overwrite=False,
                        )
                    continue
                for tool_name in tools_to_sync:
                    file = sync_request.file
                    task = asyncio.create_task(self._sync_tool(file, tool_name))
                    self.file_to_active_tool_syncs[file.id].add(task)
                    task.add_done_callback(
                        lambda _: self.file_to_active_tool_syncs[file.id].discard(task)
                    )
            except Exception as e:
                print(f"Error in worker: {e}")
                traceback.print_exc()
        with self.lock:
            self.worker_task = None

    async def _sync_tool(self, file: File, tool_name: str):
        """Sync a single tool"""
        try:
            print(f"Loading tool {tool_name} for file {file.name}")

            # TODO: Maybe we can call self.tool_library.load directly?
            async def async_load():
                return await self.tool_library.load(tool_name, file)

            loop = asyncio.get_running_loop()
            # Run the blocking loader.load in a background thread
            await loop.run_in_executor(
                None,  # Default thread pool
                lambda: asyncio.run(
                    async_load()
                ),  # TOOD: make loader.load sync and call it directly rather than using asyncio.run
            )
            print(f"Tool {tool_name} loaded for file {file.name}")
            self.tool_library.write_sync_status(file, tool_name, ToolSyncStatus.SUCCESS)
        except Exception as e:
            print(f"Error syncing file {file.id}: {e}")
            print("Full stack trace:")
            traceback.print_exc()
            self.tool_library.write_sync_status(file, tool_name, ToolSyncStatus.ERROR)

    async def _set_sync_status(self, file: File, status: SyncStatus):
        """Set the sync status of a file"""
        self.sync_status[file.id] = status
        for callback in self.callbacks:
            asyncio.create_task(callback(file, status))


class StatusTrackingQueue:
    def __init__(self):
        self.queue = asyncio.Queue()
        self.pending_tasks: set[SyncRequest] = set()

    async def put(self, req: SyncRequest):
        # We are awaiting the internal limit of items of the asyncio queue
        await self.queue.put(req)
        self.pending_tasks.add(req)

    async def get(self) -> SyncRequest:
        req = await self.queue.get()
        self.pending_tasks.remove(req)
        return req

    def is_pending(self, file_id: str) -> bool:
        return file_id in [t.file.id for t in self.pending_tasks]

    def is_empty(self) -> bool:
        return self.queue.empty()
