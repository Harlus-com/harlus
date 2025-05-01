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
from llama_index.core.schema import Node

from .config import LLM, EMBEDDING_MODEL, FASTLLM
from .mixed_retriever import MixKeywordVectorRetriever

import asyncio
from tqdm import tqdm


class DocumentPipeline:

    def __init__(
        self,
        nodes: list[Node],
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
            "date": "What is the date of the document? This should be the date the document was filed, for example if the document is a 10-K, the date should be the date of the 10-K. Format it as YYYY-MM-DD. ",
            "ticker": "What is the ticker of the stock discussed in this document (if any)?",
            "keywords": "What are the keywords in this document?",
            "source_name": "What is the source of this document? This should be one of the following: sec_filings, earning_call, investor_relations_release, other_third_party, internal",
            "title": "What is the title of this document?",
            "company_name": "What is the name of the company discussed in this document?",
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
            verbose=True,
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
            ),
            node_postprocessors=node_postprocessors,
        )

        print(" - building summary index query engine...")
        summary_query_engine = summary_index.as_query_engine(llm=LLM)

        print(" - extracting metadata from query engines...")
        tasks = [
            summary_query_engine.aquery("Extract a 3-5 line summary of the document."),
            *[
                mix_query_engine.aquery(query)
                for query in self.metadata_queries.values()
            ],
        ]

        responses = []
        for task in tqdm(
            asyncio.as_completed(tasks), total=len(tasks), desc="Extracting metadata"
        ):
            response = await task
            responses.append(response)

        self.metadata["summary"] = responses[0]

        for (metadata_name, _), response in zip(
            self.metadata_queries.items(), responses[1:]
        ):
            self.metadata[metadata_name] = response

        print(" - building mix retriever query engine tool...")
        metadata_description = "\n".join(
            [f"{key}: {value}" for key, value in self.metadata.items()]
        )
        mix_query_engine_tool = QueryEngineTool(
            query_engine=mix_query_engine,
            metadata=ToolMetadata(
                name=f"mix_qengine",
                description=f"""Use this tool to answer specific questions about the document.

                This document has the following metadata:
                {metadata_description}

                And the following summary:
                {self.metadata['summary']}
                """,
            ),
        )

        print(" - building summary query engine tool...")
        summary_query_engine_tool = QueryEngineTool(
            query_engine=summary_query_engine,
            metadata=ToolMetadata(
                name=f"summary_qengine",
                description=f"""Use this tool only when you need to summarize the document.

                This document has the following metadata:
                {metadata_description}

                And the following summary:
                {self.metadata['summary']}
                """,
            ),
        )

        print(" - building question generator ...")
        question_gen = LLMQuestionGenerator.from_defaults(
            llm=FASTLLM,
            prompt_template_str="""
                Follow the example, but instead of giving a question, always prefix the question 
                with: 'By first identifying the most relevant sources, '. Always postfix the question with:
                'Include numbers with units in your response, structure your response.' 
                """
            + DEFAULT_SUB_QUESTION_PROMPT_TMPL,
        )

        print(" - building sub question query engine ...")
        sq_query_engine = SubQuestionQueryEngine.from_defaults(
            query_engine_tools=[
                summary_query_engine_tool,
                mix_query_engine_tool,
            ],
            question_gen=question_gen,
            use_async=True,
            llm=LLM
        )

        print(" - building sub question query engine tool ...")

        doctool = QueryEngineTool(
            query_engine=sq_query_engine,
            metadata=ToolMetadata(
                name=f"{self.file_name}",
                description=f"""Use this tool to anser questions about the document with metadata:

                {metadata_description}

                And the following summary:
                {self.metadata['summary']}
                """,
            ),
        )
        self.doctool = doctool

        return self.doctool
