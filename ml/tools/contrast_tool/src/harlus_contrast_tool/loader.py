from llama_index.core.base.base_query_engine import BaseQueryEngine
from llama_index.core.retrievers import BaseRetriever

from typing import Union, Optional

from .claim_getter import ClaimQueryEnginePipeline
from .claim_checker import VerdictQueryEnginePipeline
from .config import config
from .sentence_retriever import SentenceRetrieverPipeline


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


# Qengine to extract claims from document
class ClaimQueryEngineToolLoader:
    # TODO In the future, this will take the LLM dependency as a parameter

    def get_tool_name(self) -> str:
        return "claim_query_engine_tool"

    async def load(
        self, file_path: str, unused_file_name: Optional[str] = None
    ) -> ToolWrapper:
        """
        Loads the doctool, using the given file path
        """

        # TODO confirm file path exists

        query_engine = ClaimQueryEnginePipeline.build(
            file_path=file_path,
            model_config=config["claim getter"],
        )
        return ToolWrapper(
            query_engine,
            self.get_tool_name(),
            {},  # TODO: Populate this with debug info: parsed_text.json and json_nodes.json
        )


# Qengine to verify claims against document content
class VerdictQueryEngineToolLoader:
    # TODO In the future, this will take the LLM dependency as a parameter

    def get_tool_name(self) -> str:
        return "verdict_query_engine_tool"

    async def load(
        self, file_path: str, unused_file_name: Optional[str] = None
    ) -> ToolWrapper:

        # TODO confirm file path exists

        query_engine = VerdictQueryEnginePipeline.build(
            file_path=file_path,
            models_config=config["claim checker"],
            num_questions=5,
        )
        return ToolWrapper(
            query_engine,
            self.get_tool_name(),
            {},  # TODO: Populate this with debug info: parsed_text.json and json_nodes.json
        )


# Retriever to find relevant sentences of a document, for annotation purposes
class SentenceRetrieverToolLoader:
    # TODO In the future, this will take the LLM dependency as a parameter

    def get_tool_name(self) -> str:
        return "sentence_retriever_tool"

    async def load(
        self, file_path: str, unused_file_name: Optional[str] = None
    ) -> ToolWrapper:

        # TODO confirm file path exists

        retriever = SentenceRetrieverPipeline.build(file_path)
        return ToolWrapper(
            retriever,
            self.get_tool_name(),
            {},  # TODO: Populate this with debug info: parsed_text.json and json_nodes.json
        )
