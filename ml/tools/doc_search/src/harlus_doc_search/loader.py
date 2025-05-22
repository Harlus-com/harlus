from .node_pipeline import NodePipeline
from .doc_tool_pipeline import DocumentPipeline
from .doc_tool_pipeline import DocSearchToolWrapper
from .cache import CacheOptions, CacheHelper


class ToolWrapper:
    def __init__(self, doc_tool: DocSearchToolWrapper, name: str):
        self.doc_tool = doc_tool
        self.name = name

    def get(self) -> DocSearchToolWrapper:
        return self.doc_tool

    def get_tool_name(self) -> str:
        return self.name


class DocToolLoader:

    def get_tool_name(self) -> str:
        return "doc_search"

    async def load(
        self, file_id: str, file_id_to_path: dict[str, str], cache_options: CacheOptions
    ) -> ToolWrapper:
        """
        Loads the doctool, using the given file path
        """
        cache_helper = CacheHelper(cache_options)
        nodes = await NodePipeline(file_id_to_path, cache_helper).execute(file_id)

        tool = await DocumentPipeline(nodes, file_id_to_path).execute(file_id)
        return ToolWrapper(tool, self.get_tool_name())

    async def _load_preset(self, preset_name: str) -> ToolWrapper:
        pass  # This loads a tool that already has a given file baked in
