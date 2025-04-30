from llama_index.core.tools import QueryEngineTool
from .node_pipeline import NodePipeline
from .doc_tool_pipeline import DocumentPipeline


class ToolWrapper:
    # In the future, this will take the LLM dependency as a parameter
    def __init__(self, doc_tool: QueryEngineTool, parsed_text: str, json_nodes: str):
        self.doc_tool = doc_tool
        self.parsed_text = parsed_text
        self.json_nodes = json_nodes

    def get_debug_info(self):
        # TODO: We'll come back here later to add more info
        # In the future, consider returning the document itself as bytes and/or version of the tool,
        return {
            "parsed_text": self.parsed_text,
            "json_nodes": self.json_nodes,
        }

    def get(self) -> QueryEngineTool:
        return self.doc_tool


class DocToolLoader:

    async def load(self, file_path: str, file_name: str) -> ToolWrapper:
        """
        Loads the doctool, using the given file path
        """
        node_pipeline = NodePipeline(file_path)
        parsed_text, json_nodes, nodes = await node_pipeline.execute()
        doc_tool_pipeline = DocumentPipeline(nodes, file_path, file_name)
        doc_tool = await doc_tool_pipeline.execute()
        return ToolWrapper(doc_tool, parsed_text=parsed_text, json_nodes=json_nodes)

    async def _load_preset(self, preset_name: str) -> ToolWrapper:
        pass  # This loads a tool that already has a given file baked in
