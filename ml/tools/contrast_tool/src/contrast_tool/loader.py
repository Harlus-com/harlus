from llama_index.core.tools import QueryEngineTool
from llama_index.core.base.base_query_engine import BaseQueryEngine
from llama_index.core.retrievers import BaseRetriever
from llama_index.core.schema import Node
from .doc_search_copy.node_pipeline import NodePipeline
from .doc_search_copy.doc_tool_pipeline import DocumentPipeline
from .claim_getter import ClaimGetter
from .claim_checker import ClaimChecker
from .utils import load_config
from typing import Union
import os

DEFAULT_CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config.yaml")
config = load_config(DEFAULT_CONFIG_PATH)


class ToolWrapper:

    def __init__(
        self,
        doc_tool: Union[BaseQueryEngine, BaseRetriever],
        name: str,
        debug_info: dict[str, str],
    ):
        self.doc_tool = doc_tool
        self.name = name
        self.debug_info = debug_info

    def get_debug_info(self):
        return self.debug_info

    def get(self) -> Union[BaseQueryEngine, BaseRetriever]:
        return self.doc_tool

    def get_tool_name(self) -> str:
        return self.name


class ClaimQueryToolLoader:
    # In the future, this will take the LLM dependency as a parameter

    def get_tool_name(self) -> str:
        return "claim_query_tool"

    async def load(self, file_path: str, unused_file_name: str) -> ToolWrapper:
        """
        Loads the doctool, using the given file path
        """

        query_engine = ClaimGetter(config["claim getter"]).build_query_engine(file_path)
        return ToolWrapper(
            query_engine,
            self.get_tool_name(),
            {},  # TODO: Populate this with debug info: parsed_text.json and json_nodes.json
        )


class ClaimRetrieverToolLoader:
    # In the future, this will take the LLM dependency as a parameter

    def get_tool_name(self) -> str:
        return "claim_retriever_tool"

    async def load(self, file_path: str, unused_file_name: str) -> ToolWrapper:
        """
        Loads the doctool, using the given file path
        """

        retriever = ClaimGetter(config["claim getter"]).build_sentence_retriever(
            file_path
        )
        return ToolWrapper(
            retriever,
            self.get_tool_name(),
            {},  # TODO: Populate this with debug info: parsed_text.json and json_nodes.json
        )


class ClaimCheckToolLaoder:

    def get_tool_name(self) -> str:
        return "claim_check_tool"

    async def load(self, file_path: str, unused_file_name: str) -> ToolWrapper:
        retriever = ClaimChecker(config["claim checker"]).build_retriever(file_path)
        return ToolWrapper(
            retriever,
            self.get_tool_name(),
            {},  # TODO: Populate this with debug info: parsed_text.json and json_nodes.json
        )
