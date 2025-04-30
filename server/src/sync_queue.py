import asyncio
import threading
from typing import Callable

from src.tool_library import ToolLibrary
from src.stream_manager import StreamManager

from src.file_store import File, FileStore
from src.sync_status import SyncStatus
from doc_search import DocToolLoader


MAX_CONCURRENT = 10


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
        self.sync_queue = asyncio.Queue()
        self.sync_status: dict[str, SyncStatus] = {}  # File ID -> SyncStatus
        self.lock = threading.Lock()
        self.worker_task = None
        self.callbacks: set[Callable[[File, SyncStatus], None]] = set()

    async def queue_model_sync(self, file: File):
        """Add a file to the sync queue"""
        with self.lock:
            await self._set_sync_status(file, SyncStatus.SYNC_PENDING)
            # If the queue is full, wait for it to be processed
            # Note: This is not a limit of ten items, but rather an internal limit of the asyncio queue
            await self.sync_queue.put(file)

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
            print("Worker loop")
            file = await self.sync_queue.get()
            if self.sync_status[file.id] == SyncStatus.SYNC_COMPLETE:
                self.sync_queue.task_done()
                continue

            if len(active_tasks) >= MAX_CONCURRENT:
                await asyncio.wait(active_tasks, return_when=asyncio.FIRST_COMPLETED)
                continue

            await self._set_sync_status(file, SyncStatus.SYNC_IN_PROGRESS)
            task = asyncio.create_task(self._sync_file(file))
            active_tasks.add(task)
            task.add_done_callback(active_tasks.discard)
            task.add_done_callback
        print("LOOP DONE")
        with self.lock:
            print("Worker task done")
            self.worker_task = None

    async def _sync_file(self, file: File):
        """Sync a single file"""
        try:
            doc_tool_loader = DocToolLoader()
            # TODO: Consider a force sync option
            if not self.tool_library.has_tool(
                file.absolute_path, doc_tool_loader.get_tool_name()
            ):
                tool_wrapper = await doc_tool_loader.load(file.absolute_path, file.name)
                self.tool_library.add_tool(file.absolute_path, tool_wrapper)
            else:
                # Sleep to simulate a load. This creates for better UI experience
                await asyncio.sleep(1)
            await self._set_sync_status(file, SyncStatus.SYNC_COMPLETE)
        except Exception as e:
            # Log the error and reset the status
            print(f"Error syncing file {file.id}: {e}")
            await self._set_sync_status(file, SyncStatus.SYNC_ERROR)
        finally:
            self.sync_queue.task_done()

    async def _set_sync_status(self, file: File, status: SyncStatus):
        """Set the sync status of a file"""
        self.sync_status[file.id] = status
        for callback in self.callbacks:
            asyncio.create_task(callback(file, status))
