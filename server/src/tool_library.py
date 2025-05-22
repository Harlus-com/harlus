import os
import dill
import json
from src.util import timestamp_now
from src.file_store import FileStore
from src.file_types import File
from harlus_doc_search import ToolWrapper, CacheOptions, DocToolLoader
from enum import Enum


class ToolSyncStatus(Enum):
    SUCCESS = "SUCCESS"
    ERROR = "ERROR"
    NONE = "NONE"


loaders = [
    DocToolLoader(),
]


loaders_by_name = {loader.get_tool_name(): loader for loader in loaders}


# TODO: add functionality to get all tools for a given workspace
#
# TODO: for doc_search tools, we could store the vector index by using
# llama_index built-in methods for storing and loading vector indices.
# at load time, we could build the doc_search tool from the vector index.
# Metadata could be stored seperately and pickled alongside the tool.
class ToolLibrary:
    def __init__(self, file_store: FileStore):
        self.file_store = file_store

    async def load(self, tool_name: str, file: File) -> ToolWrapper:
        tool_dir = os.path.join(os.path.dirname(file.absolute_path), "tools", tool_name)
        os.makedirs(tool_dir, exist_ok=True)
        loader = loaders_by_name[tool_name]
        tool_wrapper = await loader.load(
            file.id,
            {file.id: file.absolute_path},
            CacheOptions(
                cache_dir_path=tool_dir,
                load_from_cache=True,
                save_to_cache=True,
            ),
        )
        self._add_tool(file.absolute_path, tool_wrapper, overwrite=True)

    def has_all_tools(self, file: File):
        return len(self.get_tools_to_sync(file)) == 0

    def get_tools_to_sync(self, file: File):
        target_tools = loaders_by_name.keys()
        print(f"Target tools: {target_tools}")
        current_tools = [
            t.get_tool_name() for t in self._load_tools(file.absolute_path)
        ]
        print(f"Current tools: {current_tools}")
        return [t for t in target_tools if t not in current_tools]

    def get_tool_for_all_files(self, workspace_id: str, tool_name: str):
        files = self.file_store.get_files(workspace_id)
        all_tools = []
        for file in files.values():
            all_tools.extend(self._load_tools(file.absolute_path, filter=tool_name))
        return all_tools

    def get_tool(self, file_path: str, tool_name: str):
        matching_tools = self._load_tools(file_path, filter=tool_name)
        if len(matching_tools) == 0:
            raise ValueError(f"Tool {tool_name} not found for file {file_path}")
        if len(matching_tools) > 1:
            raise ValueError(f"Multiple tools found for {tool_name} in {file_path}")
        return matching_tools[0]

    def has_tool(self, file_path: str, tool_name: str):
        print(f"Checking if tool {tool_name} exists for {file_path}")
        file_tools = self._load_tools(file_path, filter=tool_name)
        tool_found = tool_name in file_tools
        print(
            f"Tool {tool_name} {'found' if tool_found else 'not found'} in {file_tools}"
        )
        return tool_found

    def _add_tool(
        self, file_path: str, tool_wrapper: ToolWrapper, overwrite: bool = False
    ):
        current_tools = self._load_tools(file_path)
        tool_name = tool_wrapper.get_tool_name()
        if tool_name in [t.get_tool_name() for t in current_tools] and not overwrite:
            raise ValueError(f"Tool {tool_name} already exists for file {file_path}")
        tool_dir = os.path.join(os.path.dirname(file_path), "tools", tool_name)
        os.makedirs(tool_dir, exist_ok=True)
        with open(os.path.join(tool_dir, "tool.pkl"), "wb") as f:
            dill.dump(tool_wrapper.get(), f)
        self._load_tools(file_path)

    def _load_tools(self, file_path, filter: str | None = None) -> list[ToolWrapper]:
        tools_dir = os.path.join(os.path.dirname(file_path), "tools")
        print(f"Loading tools from {tools_dir}")
        if not os.path.exists(tools_dir):
            print(f"Tools directory {tools_dir} does not exist")
            return []
        tools = []
        for tool_dir in os.listdir(tools_dir):
            if filter is not None and tool_dir != filter:
                continue
            tool_file = os.path.join(tools_dir, tool_dir, "tool.pkl")
            if not os.path.exists(tool_file):
                print(f"Tool file {tool_file} does not exist")
                continue
            with open(tool_file, "rb") as f:
                # TODO: As a saftey we should check that the the unpickled tool corresponds to the given file
                # We can do this by storing the file hash next to the tool
                # Then we can check that the file hash matches the current file on disk, otherwise discard the tool
                tool = dill.load(f)
                tool_wrapper = ToolWrapper(tool, tool_dir)
                tools.append(tool_wrapper)
        return tools

    def write_sync_status(
        self, file: File, tool_name: str, status: ToolSyncStatus, overwrite: bool = True
    ):
        last_sync_status_file = os.path.join(
            os.path.dirname(file.absolute_path), "sync_status.json"
        )
        if not os.path.exists(last_sync_status_file):
            with open(last_sync_status_file, "w") as f:
                json.dump({}, f)
        with open(last_sync_status_file, "r") as f:
            last_sync_status = json.load(f)
        if tool_name not in last_sync_status or overwrite:
            last_sync_status[tool_name] = {
                "status": status.value,
                "timestamp": str(timestamp_now()),
            }
        with open(last_sync_status_file, "w") as f:
            json.dump(last_sync_status, f, indent=2)

    def get_last_sync_status(self, file_id: str) -> dict[str, ToolSyncStatus]:
        file = self.file_store.get_file(file_id)
        last_sync_status_file = os.path.join(
            os.path.dirname(file.absolute_path), "sync_status.json"
        )
        statuses = {
            tool_name: ToolSyncStatus.NONE for tool_name in loaders_by_name.keys()
        }
        if not os.path.exists(last_sync_status_file):
            return statuses
        with open(last_sync_status_file, "r") as f:
            last_sync_status = json.load(f)
        for tool_name, value in last_sync_status.items():
            statuses[tool_name] = ToolSyncStatus(value["status"])
        return statuses

    def all_tool_names(self):
        return loaders_by_name.keys()
