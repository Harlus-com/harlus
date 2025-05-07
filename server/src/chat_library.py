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
        self.universal_tools = []


    def load_chat(self, workspace_id: str):

        # get persistent directory
        workspace_path = self.file_store.get_workspace_path(workspace_id=workspace_id)
        workspace = self.get_workspaces()[workspace_id]
        chat_persist_dir = os.path.join(os.path.dirname(workspace_path), "chat")
        os.makedirs(chat_persist_dir, exist_ok=True)

        # create chat model from persistent directory
        chat_model = ChatAgentGraph(persist_dir=chat_persist_dir)
        chat_model_wrapper = ChatModelWrapper(chat_model, name=workspace.name)
        self.chat_models[workspace_id].append(chat_model_wrapper)

        # update chat tools
        self.update_chat_tools(workspace_id=workspace_id)
        print(f"Loaded chat_model for workspace {workspace.name}")

    def load_chats(self):
        for workspace_id in self.file_store.get_workspaces().keys():
            self.load_chat(workspace_id=workspace_id)

    def update_chat_tools(self, tool_library):
        for workspace_id in self.file_store.get_workspaces().keys():
            self.update_chat_tools(workspace_id=workspace_id, tool_library=tool_library)

    def update_chat_tools(self, workspace_id: str):
        chat_model_wrapper = self.get_chat(workspace_id=workspace_id)
        doc_search_tools = [tool.get() for tool in self.tool_library.get_tool_for_all_files("doc_search")]
        chat_model_wrapper.chat_model.update_tools(doc_search_tools)


    def get_chat(self, workspace_id: str):

        chat_model_wrappers = [
            t for t in self.chat_models[workspace_id]
        ]
        if len(chat_model_wrappers) == 0:
            raise ValueError(f"Chat model not found for workspace {workspace_id}")
        if len(chat_model_wrappers) > 1:
            raise ValueError(f"Multiple chat models found for workspace {workspace_id}")
        return chat_model_wrappers[0].get()

   