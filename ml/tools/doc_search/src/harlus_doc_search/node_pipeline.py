# from llama_parse import LlamaParse

from llama_index.core.extractors import (
    SummaryExtractor,
    KeywordExtractor,
)

from llama_index.node_parser.docling import DoclingNodeParser


from llama_index.core.schema import Node

from llama_index.readers.docling import DoclingReader

import json

from .node_parse import *
from .node_store import *
from .config import NUM_WORKERS, FASTLLM
from .cache import CacheHelper

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

    def __init__(self, file_id_to_path: dict[str, str], cache_helper: CacheHelper):
        self.file_id_to_path = file_id_to_path
        self.cache_helper = cache_helper
        self.nodes = []

    async def execute(self, file_id: str) -> tuple[str, str, list[Node]]:
        nodes_out = self.cache_helper.unpickle("nodes")
        if nodes_out is not None:
            self.cache_helper.dump_json(
                "debug/nodes.json", nodes_to_json_obj(nodes_out)
            )
            return nodes_out

        print(f"Creating nodes for {file_id} ...")

        # TODO: Docling gives us control over which models we use.
        # We can use remote OpenAI LLMs or a remote open source model "SmolDocling"
        # Default configuration should be a local set-up.
        print(" - reading document with Docling...")
        reader = DoclingReader(export_type=DoclingReader.ExportType.JSON)
        documents = reader.load_data(self.file_id_to_path[file_id])

        print(" - creating nodes from documents...")
        node_parser = DoclingNodeParser()
        nodes = node_parser.get_nodes_from_documents(documents)

        print(" - adding metadata to nodes...")
        extractor_list = [
            SummaryExtractor(num_workers=NUM_WORKERS, llm=FASTLLM),
            KeywordExtractor(num_workers=NUM_WORKERS, llm=FASTLLM),
        ]
        nodes = await add_metadata_to_nodes(nodes, extractor_list)

        print(" - adding file path to nodes...")
        nodes_out = []
        for node in nodes:
            node.metadata["file_id"] = file_id
            nodes_out.append(node)

        self.cache_helper.pickle("nodes", nodes_out)
        self.cache_helper.dump_json("debug/nodes.json", nodes_to_json_obj(nodes_out))
        return nodes_out
