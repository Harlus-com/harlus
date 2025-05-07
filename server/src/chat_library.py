from llama_index.core.tools import QueryEngineTool

import os
import dill
from collections import defaultdict

from src.file_store import FileStore, File
from harlus_chat import ChatModelWrapper, ChatAgentGraph
from src.tool_library import ToolLibrary


class ChatLibrary:
    """
    Library which manages chat models.

    ChatLibrary links each chat model to a workspace. Currently ChatLibrary expects
    that there is exactly one chat model for each workspace.

    Different conversations with one chat model are handled within the ChatModelWrapper class.

    """

    def __init__(self, file_store: FileStore, tool_library: ToolLibrary):

        self.chat_models: dict[str, list[ChatModelWrapper]] = defaultdict(list)
        self.file_store = file_store
        self.tool_library = tool_library

    def create_chat_models(self):
        """
        Creates a chat model for each workspace.

        These chat models use a cached chat history, which is stored by the tool itself.
        """
        for workspace_id in self.file_store.get_workspaces().keys():
            workspace = self.file_store.get_workspaces()[workspace_id]
            chat_persist_dir = os.path.join(workspace.absolute_path, "chat")
            os.makedirs(chat_persist_dir, exist_ok=True)
            chat_model = ChatAgentGraph(persist_dir=chat_persist_dir)
            chat_model_wrapper = ChatModelWrapper(chat_model, name=workspace.name)
            self.chat_models[workspace_id].append(chat_model_wrapper)
            print(f"Loaded chat_model for workspace {workspace.name}")

    def load(self):
        self.create_chat_models()
        self.update_chat_tools()

    def start_thread(self, workspace_id: str) -> str:
        chat_model = self._get(workspace_id=workspace_id)
        chat_model.start_new_thread()
        thread_id = chat_model.get_current_thread_id()
        self._save_thread_id(workspace_id, thread_id)
        return thread_id

    def _save_thread_id(self, workspace_id: str, thread_id: str):
        workspace = self.file_store.get_workspaces()[workspace_id]
        chat_dir = os.path.join(workspace.absolute_path, "chat")
        os.makedirs(chat_dir, exist_ok=True)
        with open(os.path.join(chat_dir, "thread_ids.txt"), "a") as f:
            f.write(thread_id + "\n")

    def _load_thread_ids(self, workspace_id: str) -> list[str]:
        workspace = self.file_store.get_workspaces()[workspace_id]
        thread_id_path = os.path.join(workspace.absolute_path, "chat", "thread_ids.txt")
        with open(thread_id_path, "r") as f:
            return [line.strip() for line in f.readlines()]

    def update_chat_tools(self):
        for workspace_id in self.file_store.get_workspaces().keys():
            chat_model = self._get(workspace_id=workspace_id)
            doc_search_tools = [
                tool.get()
                for tool in self.tool_library.get_tool_for_all_files("doc_search")
            ]
            chat_model.update_tools(doc_search_tools)

    def _get(self, workspace_id: str) -> ChatAgentGraph:
        chat_model_wrappers = [t for t in self.chat_models[workspace_id]]
        if len(chat_model_wrappers) == 0:
            raise ValueError(f"Chat model not found for workspace {workspace_id}")
        if len(chat_model_wrappers) > 1:
            raise ValueError(f"Multiple chat models found for workspace {workspace_id}")

        return chat_model_wrappers[0].get()

    def get_and_resume_thread(
        self, workspace_id: str, thread_id: str
    ) -> ChatAgentGraph:
        if not thread_id in self._load_thread_ids(workspace_id):
            raise ValueError(f"Thread {thread_id} not found")
        chat_model = self._get(workspace_id)
        if chat_model.get_current_thread_id() != thread_id:
            chat_model.resume_thread(thread_id)
        return chat_model
