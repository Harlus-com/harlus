from llama_index.core.tools import QueryEngineTool

import os
import pickle

from src.file_store import FileStore


class ToolLibrary:
    def __init__(self, file_store: FileStore):
        self.tools: list[QueryEngineTool] = []
        self.file_store = file_store

    def load_tools(self):
        for workspace_id in self.file_store.get_workspaces().keys():
            for file in self.file_store.get_files(workspace_id).values():
                file_dir = os.path.join(os.path.dirname(file.absolute_path), "tools")
                if os.path.exists(file_dir):
                    for tool_file in os.listdir(file_dir):
                        with open(os.path.join(file_dir, tool_file), "rb") as f:
                            tool = pickle.load(f)
                            self.tools.append(tool)

    def get_tools(self):
        return [t for t in self.tools]

    def add_tool(self, file_path: str, tool: QueryEngineTool):
        self.tools.append(tool)
        file_dir = os.path.join(os.path.dirname(file_path), "tools")
        os.makedirs(file_dir, exist_ok=True)
        # TODO: Pass the ToolWrapper, which will include a tool name
        # Also write the debug info to disk
        with open(os.path.join(file_dir, "tool.pkl"), "wb") as f:
            pickle.dump(tool, f)
