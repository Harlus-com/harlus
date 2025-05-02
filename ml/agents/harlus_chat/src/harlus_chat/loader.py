from llama_index.core.tools import QueryEngineTool
from llama_index.core.schema import Node
from .node_pipeline import NodePipeline
from .doc_tool_pipeline import DocumentPipeline


class AWrapper:
    # In the future, this will take the LLM dependency as a parameter
    def __init__(
        self, doc_tool: QueryEngineTool, name: str, debug_info: dict[str, str]
    ):
        self.doc_tool = doc_tool
        self.name = name
        self.debug_info = debug_info

    def get_debug_info(self):
        return self.debug_info

    def get(self) -> QueryEngineTool:
        return self.doc_tool

    def get_tool_name(self) -> str:
        return self.name


class DocToolLoader:

    def get_tool_name(self) -> str:
        return "doc_search"

    async def load(self, file_path: str, file_name: str) -> ToolWrapper:
        """
        Loads the doctool, using the given file path
        """
        parsed_text, json_nodes, nodes = await NodePipeline(file_path).execute()
        tool = await DocumentPipeline(nodes, file_path, file_name).execute()
        return ToolWrapper(
            tool,
            self.get_tool_name(),
            {"parsed_text.json": parsed_text, "json_nodes.json": json_nodes},
        )

    async def _load_preset(self, preset_name: str) -> ToolWrapper:
        pass  # This loads a tool that already has a given file baked in
