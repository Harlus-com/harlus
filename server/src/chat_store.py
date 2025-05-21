import os
import json
import asyncio
from datetime import datetime
from typing import Dict, Optional, Any

from harlus_workspace_chat.build_graph import ChatAgentGraph
from pydantic import BaseModel, ConfigDict, Field
from src.tool_library import ToolLibrary
from src.util import Timestamp, snake_to_camel, timestamp_now
from src.file_store import FileStore, Workspace

JsonType = Dict[str, Any]


class ChatThread(BaseModel):
    id: str
    title: str
    last_message_at: str = Field(alias="lastMessageAt")
    created_at: Timestamp = Field(alias="createdAt")

    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=snake_to_camel,
        from_attributes=True,
        frozen=True,
    )


class ChatStore:
    def __init__(self, file_store: FileStore, tool_library: ToolLibrary):
        self.file_store = file_store
        self.tool_library = tool_library
        self.chat_models: dict[str, ChatAgentGraph] = {}
        self.last_save: Dict[str, JsonType] = {}  # thread_id -> json
        self.save_task: Optional[asyncio.Task] = None
        self.lock = asyncio.Lock()

        for workspace in self.file_store.get_workspaces().values():
            add_workspace(workspace)

    def add_workspace(self, workspace: Workspace):
        add_workspace(workspace)

    # TODO: Probably worth moving this somewhere else
    def get_chat_model(self, workspace_id: str, thread_id: str) -> ChatAgentGraph:
        """
        Get a chat model, and set the active thread to the given thread_id.
        """
        if workspace_id not in self.chat_models:
            workspace = self.file_store.get_workspaces()[workspace_id]
            chat_dir = os.path.join(workspace.absolute_path, "chat")
            file_id_to_path = {
                file.id: file.absolute_path
                for file in self.file_store.get_files(workspace_id).values()
            }
            self.chat_models[workspace_id] = ChatAgentGraph(
                file_id_to_path, persist_dir=chat_dir
            )

        # TODO: Get rid of caching
        chat_model = self.chat_models[workspace_id]
        if not self.thread_exists(workspace_id, thread_id):
            raise ValueError(f"Thread {thread_id} not found")
        if chat_model.get_current_thread_id() != thread_id:
            chat_model.set_thread(thread_id)
        doc_search_tools = [
            tool.get()
            for tool in self.tool_library.get_tool_for_all_files(
                workspace_id, "doc_search"
            )
        ]
        chat_model.update_tools(doc_search_tools)

        return chat_model

    def get_thread_ids(self, workspace_id: str) -> list[str]:
        threads_file = self._get_chat_file_path(workspace_id, "threads.json")
        with open(threads_file, "r") as f:
            threads = json.load(f)
        return list(threads.keys())

    def thread_exists(self, workspace_id: str, thread_id: str) -> bool:
        return thread_id in self.get_thread_ids(workspace_id)

    def create_thread(self, workspace_id: str, thread_id: str, title: str):
        """Create a new thread and save it to threads.json"""
        thread = ChatThread(
            id=thread_id,
            title=title,
            last_message_at=datetime.now().strftime("%I:%M %p"),
            created_at=timestamp_now(),
        )
        threads_file = self._get_chat_file_path(workspace_id, "threads.json")
        with open(threads_file, "r") as f:
            threads = json.load(f)
        threads[thread_id] = thread.model_dump()
        with open(threads_file, "w") as f:
            json.dump(threads, f, indent=2)

    def delete_thread(self, workspace_id: str, thread_id: str):
        """Delete the thread from threads.json and its chat history from disk"""
        threads_file = self._get_chat_file_path(workspace_id, "threads.json")
        with open(threads_file, "r") as f:
            threads = json.load(f)
        if thread_id in threads:
            del threads[thread_id]
            with open(threads_file, "w") as f:
                json.dump(threads, f, indent=2)

        chat_file = self._get_chat_file_path(workspace_id, thread_id)
        if os.path.exists(chat_file):
            os.remove(chat_file)

    def rename_thread(self, workspace_id: str, thread_id: str, title: str):
        """Rename a thread in threads.json"""
        threads_file = self._get_chat_file_path(workspace_id, "threads.json")
        with open(threads_file, "r") as f:
            threads = json.load(f)
        if not thread_id in threads:
            raise ValueError(f"Thread {thread_id} not found")
        threads[thread_id]["title"] = title
        with open(threads_file, "w") as f:
            json.dump(threads, f, indent=2)

    def get_threads(self, workspace_id: str) -> list[ChatThread]:
        """Get all threads for a workspace"""
        threads_file = self._get_chat_file_path(workspace_id, "threads.json")
        with open(threads_file, "r") as f:
            threads = json.load(f)
            print("loaded threads", threads)
        return [ChatThread.model_validate(thread) for thread in threads.values()]

    def get_thread(self, workspace_id: str, thread_id: str) -> Optional[ChatThread]:
        """Get thread information from threads.json"""
        threads_file = self._get_chat_file_path(workspace_id, "threads.json")
        with open(threads_file, "r") as f:
            threads = json.load(f)
        if thread_id not in threads:
            return None
        thread = threads[thread_id]
        return ChatThread.model_validate(thread)

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


def add_workspace(workspace: Workspace):
    chat_dir = os.path.join(workspace.absolute_path, "chat")
    if not os.path.exists(chat_dir):
        os.makedirs(chat_dir)
    threads_file = os.path.join(chat_dir, "threads.json")
    if not os.path.exists(threads_file):
        with open(threads_file, "w") as f:
            json.dump({}, f, indent=2)
