from llama_index.core import (
    SimpleKeywordTableIndex,
    VectorStoreIndex,
    SummaryIndex,
    StorageContext,
    get_response_synthesizer,
)

from llama_index.core.tools import QueryEngineTool, ToolMetadata
from llama_index.core.retrievers import (
    RecursiveRetriever,
    VectorIndexRetriever,
    KeywordTableSimpleRetriever,
)
from llama_index.core.query_engine import RetrieverQueryEngine, SubQuestionQueryEngine
from llama_index.core.postprocessor import LLMRerank, MetadataReplacementPostProcessor
from llama_index.core.question_gen import LLMQuestionGenerator
from llama_index.core.question_gen.prompts import DEFAULT_SUB_QUESTION_PROMPT_TMPL
from typing import List
from llama_index.core.schema import Node

from .config import LLM, EMBEDDING_MODEL, FASTLLM
from .mixed_retriever import MixKeywordVectorRetriever


import asyncio
from tqdm import tqdm


class DocumentPipeline:

    def __init__(
        self,
        nodes: List[Node],
        file_path: str,
        file_name: str,
        tool_cache_file_name: str = "doc_tool.pkl",
        metadata_cache_file_name: str = "doc_metadata.json",
    ):
        self.tool_cache_file_name = tool_cache_file_name
        self.metadata_cache_file_name = metadata_cache_file_name
        self.nodes = nodes
        self.file_path = file_path
        self.file_name = file_name
        self.query_engine = None
        self.metadata = {}
        self.metadata_queries = {
            "date": "Find the date of the document. This should be the date the document was filed, for example if the document is a 10-K, the date should be the date of the 10-K. Format it as YYYY-MM-DD. ",
            "ticker": "Find the ticker of the stock discussed in this document (if any).",
            "keywords": "Give 5-10 keywords that describe the document.",
            "source_name": "Find the source of this document. This should be one of the following: sec_filings, earning_call, investor_relations_release, other_third_party, internal",
            "title": "Provide a title for this document.",
            "company_name": "Find the name of the company which is the subject of this document.",
        }

    async def execute(self) -> QueryEngineTool:

        print("getting single doc query engine from nodes")

        print(" - building vector index ...")
        vector_index = VectorStoreIndex(self.nodes, embed_model=EMBEDDING_MODEL)

        print(" - building vector retriever ...")
        vector_retriever = VectorIndexRetriever(index=vector_index, similarity_top_k=7)

        print(" - building keyword index ...")
        storage_context = StorageContext.from_defaults()
        storage_context.docstore.add_documents(self.nodes)
        keyword_index = SimpleKeywordTableIndex(
            self.nodes, storage_context=storage_context,
            llm=FASTLLM
        )

        print(" - building summary index ...")
        summary_index = SummaryIndex(self.nodes, embed_model=EMBEDDING_MODEL)

        print(" - building keyword retriever ...")
        keyword_retriever = KeywordTableSimpleRetriever(
            index=keyword_index, similarity_top_k=7
        )

        print(" - building mix keyword vector retriever ...")
        mix_retriever = MixKeywordVectorRetriever(vector_retriever, keyword_retriever)

        print(" - building recursive keyword vector retriever ...")
        recursive_retriever = RecursiveRetriever(
            "vector",
            retriever_dict={
                "vector": mix_retriever,
            },
            node_dict={node.node_id: node for node in self.nodes},
            verbose=False,
        )

        node_postprocessors = [
            MetadataReplacementPostProcessor(target_metadata_key="window"),
            LLMRerank(choice_batch_size=15, top_n=8, llm=FASTLLM),
        ]

        print(" - building mix keyword vector retriever query engine ...")
        mix_query_engine = RetrieverQueryEngine(
            retriever=recursive_retriever,
            response_synthesizer=get_response_synthesizer(
                response_mode="tree_summarize",
                llm=LLM,
                verbose=False
            ),
            node_postprocessors=node_postprocessors,
        )

        print(" - building summary index query engine...")
        summary_query_engine = summary_index.as_query_engine(llm=LLM)

        print(" - extracting metadata from query engines...")
        # Create a mapping of queries to their corresponding metadata names
        query_to_metadata = {
            "Extract a 3-5 line summary of the document.": "summary",
            **{query: name for name, query in self.metadata_queries.items()}
        }

        # Create tasks with their corresponding metadata names
        tasks = {
            query: query_engine.aquery(query)
            for query, query_engine in [
                ("Extract a 3-5 line summary of the document.", summary_query_engine),
                *[(query, mix_query_engine) for query in self.metadata_queries.values()]
            ]
        }

        # Process responses and map them to metadata
        for query, task in tqdm(
            tasks.items(), total=len(tasks), desc="Extracting metadata"
        ):
            response = await task
            self.metadata[query_to_metadata[query]] = response

        print(" - building mix retriever query engine tool...")
        metadata_description = "\n".join(
            [f"{key}: {value}" for key, value in self.metadata.items()]
        )
        mix_query_engine_tool = QueryEngineTool(
            query_engine=mix_query_engine,
            metadata=ToolMetadata(
                name=f"{self.file_name}_mix",
                description=f"""Use this tool to answer specific questions about the document.

                This document has the following metadata:
                {metadata_description}

                """,
            ),
        )

        return mix_query_engine_tool 
