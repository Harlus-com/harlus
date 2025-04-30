import threading
from fastapi import WebSocket
from src.file_store import File, FileStore
from src.sync_queue import SyncQueue
from src.sync_status import SyncStatus
from src.stream_manager import StreamManager

lock = threading.Lock()

workspace_sync_managers: dict[str, "WorkspaceSyncManager"] = {}


def get_workspace_sync_manager(
    stream_manager: StreamManager,
    sync_queue: SyncQueue,
    file_store: FileStore,
    workspace_id: str,
) -> "WorkspaceSyncManager":
    with lock:
        if workspace_id not in workspace_sync_managers:
            manager = WorkspaceSyncManager(
                stream_manager, sync_queue, file_store, workspace_id
            )
            workspace_sync_managers[workspace_id] = manager
            manager.sync_queue.register_callback(manager._on_file_status_change)

        return workspace_sync_managers[workspace_id]


class WorkspaceSyncManager:
    def __init__(
        self,
        stream_manager: StreamManager,
        sync_queue: SyncQueue,
        file_store: FileStore,
        workspace_id: str,
    ):
        self.stream_manager = stream_manager
        self.sync_queue = sync_queue
        self.file_store = file_store
        self.workspace_id = workspace_id

    async def close(self):
        await self.stream_manager.disconnect(self.workspace_id)

    async def open(self, websocket: WebSocket):
        await self.stream_manager.connect(websocket, self.workspace_id)

    async def sync_workspace(self):
        for file in self.file_store.get_files(self.workspace_id).values():
            print("Syncing file", file.id)
            await self.sync_queue.queue_model_sync(file)

    async def _on_file_status_change(self, file: File, status: SyncStatus):
        print("File status changed", file.id, status)
        if file.workspace_id == self.workspace_id:
            await self.stream_manager.broadcast_file_status(file, status)
            await self.stream_manager.broadcast_workspace_status(
                self.workspace_id, self._calculate_workspace_status()
            )

    def get_workspace_status(self) -> SyncStatus:
        return self._calculate_workspace_status()

    def _calculate_workspace_status(self) -> SyncStatus:
        """Calculate the current status of a workspace"""
        files = self.file_store.get_files(self.workspace_id)
        if not files:
            return SyncStatus.SYNC_COMPLETE

        statuses = [self.sync_queue.get_sync_status(file.id) for file in files.values()]
        if SyncStatus.SYNC_IN_PROGRESS in statuses:
            return SyncStatus.SYNC_IN_PROGRESS
        if all(status == SyncStatus.SYNC_COMPLETE for status in statuses):
            return SyncStatus.SYNC_COMPLETE
        return SyncStatus.UNKNOWN
