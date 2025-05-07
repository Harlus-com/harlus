from llama_parse import LlamaParse

from llama_index.core.extractors import (
    SummaryExtractor,
    KeywordExtractor,
)

from llama_index.core.node_parser import (
    MarkdownElementNodeParser,
    SentenceWindowNodeParser,
)

from llama_index.core.schema import Node

import os
import json

from .node_parse import *
from .node_store import *
from .config import NUM_WORKERS, LLM, FASTLLM, LLAMA_CLOUD_API_KEY


# TODO: use IngestionPipeline framework from llama_index


class NodePipeline:
    """
    NodePipeline is a class that handles the creation and caching of nodes from PDF documents.

    This class takes a PDF file and processes it through several steps:
    1. Parses the PDF into JSON using LlamaParse
    2. Creates nodes from the parsed JSON
    3. Adds relationships between nodes
    4. Splits tables into separate nodes
    5. Adds metadata (summaries and keywords) to nodes
    6. Creates fine-grained nodes using sentence windows
    7. Saves all nodes to a JSON file for caching


    Attributes:
        file (File): The PDF file to process
        cache_file_name (str): Name of the JSON file to store cached nodes
        nodes (List[Node]): List of processed nodes

    Methods:
        _create(): Creates nodes from the PDF file
        _save(): Saves nodes to a JSON file
        _load(): Internal method to load nodes from the cache file or create them if the cache file does not exist
        cache(): Creates and saves nodes to the cache file
        get_nodes(): External method to return the nodes, either from the cache or by creating them
    """

    def __init__(self, file_path: str, cache_file_name: str = "nodes.json"):
        self.file_path = file_path
        self.cache_file_name = cache_file_name
        self.nodes = []

    async def execute(self) -> tuple[str, str, list[Node]]:

        # TODO: test if simpler markdown parser is better

        print(f"Creating nodes for {self.file_path} ...")
        print(" - parsing PDF to JSON...")
        json_ = LlamaParse(api_key=LLAMA_CLOUD_API_KEY).get_json_result(self.file_path)

        print(" - creating nodes from JSON...")
        nodes = create_nodes_from_llamaparse_json(json_, self.file_path)

        print(" - adding node relationships...")
        nodes = add_node_relationships(nodes)

        print(" - splitting tables...")
        markdown_parser = MarkdownElementNodeParser(
            show_progress=True, llm=FASTLLM, num_workers=5
        )  # do not show progress as these will be run in parallel
        nodes = await split_table_nodes(nodes, markdown_parser)

        print(" - adding metadata to nodes...")
        extractor_list = [
            SummaryExtractor(num_workers=NUM_WORKERS, llm=FASTLLM),
            KeywordExtractor(num_workers=NUM_WORKERS, llm=FASTLLM),
        ]
        nodes = await add_metadata_to_nodes(nodes, extractor_list)

        print(" - splitting text nodes...")
        sentence_window_parser = SentenceWindowNodeParser.from_defaults(
            window_size=3,
            window_metadata_key="window",
            original_text_metadata_key="original_text",
        )
        nodes = split_text_nodes(nodes, sentence_window_parser)

        print(" - adding file path to nodes...")
        nodes_out = []
        for node in nodes:
            node.metadata["file_path"] = self.file_path
            nodes_out.append(node)

        return (
            json.dumps(json_, indent=2),
            json.dumps(nodes_to_json_obj(nodes_out), indent=2),
            nodes_out,
        )
