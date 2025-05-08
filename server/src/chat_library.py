from llama_index.core.tools import QueryEngineTool

import os
import dill
from collections import defaultdict

from src.file_store import FileStore
from harlus_chat import ChatModelWrapper, ChatAgentGraph
from src.tool_library import ToolLibrary
from src.chat_store import ChatStore


class ChatLibrary:
    """
    Library which manages chat models.

    ChatLibrary links each chat model to a workspace. Currently ChatLibrary expects
    that there is exactly one chat model for each workspace.

    Different conversations with one chat model are handled within the ChatModelWrapper class.

    """

    def __init__(
        self, file_store: FileStore, tool_library: ToolLibrary, chat_store: ChatStore
    ):
        self.chat_store = chat_store
        self.chat_models: dict[str, list[ChatModelWrapper]] = defaultdict(list)
        self.file_store = file_store
        self.tool_library = tool_library
        self.chat_store = chat_store

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

    def set_thread(self, workspace_id: str, thread_id: str):
        chat_model = self._get(workspace_id=workspace_id)
        chat_model.set_thread(thread_id)

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
        thread = self.chat_store.get_thread(workspace_id, thread_id)
        if not thread:
            raise ValueError(f"Thread {thread_id} not found")
        chat_model = self._get(workspace_id)
        if chat_model.get_current_thread_id() != thread_id:
            chat_model.resume_thread(thread_id)
        return chat_model
