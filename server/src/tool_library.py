from llama_index.core.tools import QueryEngineTool

import os
import pickle
from collections import defaultdict

from src.file_store import FileStore
from doc_search import ToolWrapper


class ToolLibrary:
    def __init__(self, file_store: FileStore):
        self.file_name_to_tools: dict[str, list[ToolWrapper]] = defaultdict(list)
        self.file_store = file_store

    def load_tools(self):
        for file in self.file_store.get_all_files():
            tools_dir = os.path.join(os.path.dirname(file.absolute_path), "tools")
            if not os.path.exists(tools_dir):
                continue
            for tool_dir in os.listdir(tools_dir):
                tool_file = os.path.join(tools_dir, tool_dir, "tool.pkl")
                if not os.path.exists(tool_file):
                    print(f"Tool file {tool_file} does not exist")
                    continue
                with open(tool_file, "rb") as f:
                    # TODO: As a saftey we should check that the the unpickled tool corresponds to the given file
                    # We can do this by storing the file hash next to the tool
                    # Then we can check that the file hash matches the current file on disk, otherwise discard the tool
                    tool = pickle.load(f)
                    tool_wrapper = ToolWrapper(tool, tool_dir, debug_info={})
                    self.file_name_to_tools[file.absolute_path].append(tool_wrapper)
        for file_name, tools in self.file_name_to_tools.items():
            print(f"Loaded tools for {file_name}: {[t.get_tool_name() for t in tools]}")

    def get_tools(self):
        return [t for t in self.tools]

    def has_tool(self, file_path: str, tool_name: str):
        print(f"Checking if tool {tool_name} exists for {file_path}")
        if file_path not in self.file_name_to_tools:
            print(f"File {file_path} not found")
            return False
        file_tools = [t.get_tool_name() for t in self.file_name_to_tools[file_path]]
        tool_found = tool_name in file_tools
        print(
            f"Tool {tool_name} {'found' if tool_found else 'not found'} in {file_tools}"
        )
        return tool_found

    def add_tool(self, file_path: str, tool_wrapper: ToolWrapper):
        current_tools = self.file_name_to_tools[file_path]
        tool_name = tool_wrapper.get_tool_name()
        if tool_name in [t.get_tool_name() for t in current_tools]:
            raise ValueError(f"Tool {tool_name} already exists for file {file_path}")
        tool_dir = os.path.join(os.path.dirname(file_path), "tools", tool_name)
        debug_dir = os.path.join(tool_dir, "debug")
        os.makedirs(tool_dir, exist_ok=True)
        os.makedirs(debug_dir, exist_ok=True)
        with open(os.path.join(tool_dir, "tool.pkl"), "wb") as f:
            pickle.dump(tool_wrapper.get(), f)
        for key, value in tool_wrapper.get_debug_info().items():
            with open(os.path.join(debug_dir, key), "w") as f:
                f.write(value)
