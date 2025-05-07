import os
import json
import asyncio
from typing import Dict, Optional, Any
from src.file_store import FileStore

JsonType = Dict[str, Any]


class ChatStore:
    def __init__(self, file_store: FileStore):
        self.file_store = file_store
        self.last_save: Dict[str, JsonType] = {}  # thread_id -> json
        self.save_task: Optional[asyncio.Task] = None
        self.lock = asyncio.Lock()

    async def save_chat_history(
        self, workspace_id: str, thread_id: str, blob: JsonType
    ):
        """Add a save request to the queue. The actual save will happen after debounce."""
        async with self.lock:
            self.last_save[thread_id] = blob
            if self.save_task is None or self.save_task.done():
                print("Creating new save task")
                self.save_task = asyncio.create_task(self._debounced_save(workspace_id))

    async def _debounced_save(self, workspace_id: str):
        """Debounced save mechanism that saves the last queued state for each thread."""
        print("Saving chat history", workspace_id)
        await asyncio.sleep(1)
        async with self.lock:
            os.makedirs(self._get_chat_dir(workspace_id), exist_ok=True)
            for thread_id, blob in self.last_save.items():
                file_path = self._get_chat_file_path(workspace_id, thread_id)
                with open(file_path, "w") as f:
                    json.dump(blob, f, indent=2)
            self.last_save.clear()

    def get_chat_history(self, workspace_id: str, thread_id: str) -> str:
        """Read chat history from disk."""
        try:
            with open(self._get_chat_file_path(workspace_id, thread_id), "r") as f:
                return json.load(f)
        except FileNotFoundError:
            return {"messagePairs": []}

    def _get_chat_dir(self, workspace_id: str) -> str:
        workspace = self.file_store.get_workspaces()[workspace_id]
        return os.path.join(workspace.absolute_path, "chat")

    def _get_chat_file_path(self, workspace_id: str, file_name: str) -> str:
        return os.path.join(self._get_chat_dir(workspace_id), file_name)
