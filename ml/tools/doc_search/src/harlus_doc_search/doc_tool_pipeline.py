from llama_index.core import (
    SimpleKeywordTableIndex,
    VectorStoreIndex,
    SummaryIndex,
    StorageContext,
    get_response_synthesizer,
)

from llama_index.core.tools import QueryEngineTool, ToolMetadata, RetrieverTool
from llama_index.core.retrievers import (
    RecursiveRetriever,
    VectorIndexRetriever,
    KeywordTableSimpleRetriever,
    SummaryIndexRetriever,
)
from llama_index.core.query_engine import RetrieverQueryEngine, SubQuestionQueryEngine
from llama_index.core.postprocessor import LLMRerank
from llama_index.core.question_gen import LLMQuestionGenerator
from llama_index.core.question_gen.prompts import DEFAULT_SUB_QUESTION_PROMPT_TMPL
from typing import List
from llama_index.core.schema import Node
from .config import LLM, EMBEDDING_MODEL, FASTLLM, MAX_CONTEXT_LENGTH
from .mixed_retriever import MixKeywordVectorRetriever

from pydantic import BaseModel
import os
import asyncio
from tqdm import tqdm


class DocSearchToolMetadata(BaseModel):
    date: str
    ticker: str
    keywords: str
    source_name: str
    friendly_name: str
    company_name: str
    summary: str
    file_id: str


class DocSearchToolWrapper(BaseModel):
    semantic_query_engine_tool: QueryEngineTool
    summary_query_engine_tool: QueryEngineTool
    sub_question_semantic_query_engine_tool: QueryEngineTool
    summary_retriever_tool: RetrieverTool
    semantic_retriever_tool: RetrieverTool
    metadata: DocSearchToolMetadata
    name: str
    tool_class: str
    description: str

    class Config:
        arbitrary_types_allowed = True


# TODO: nb. retrieved nodes is important parameter. Should pull this into an application config file.
class DocumentPipeline:

    def __init__(
        self,
        nodes: List[Node],
        file_id_to_path: dict[str, str],
        tool_cache_file_name: str = "doc_tool.pkl",
        metadata_cache_file_name: str = "doc_metadata.json",
    ):
        self.tool_cache_file_name = tool_cache_file_name
        self.metadata_cache_file_name = metadata_cache_file_name
        self.nodes = nodes
        self.file_id_to_path = file_id_to_path
        self.query_engine = None
        self.metadata = {}
        self.metadata_queries = {
            "date": "Find the date of the document. This should be the date the document was filed, for example if the document is a 10-K, the date should be the date of the 10-K. Format it as YYYY-MM-DD. ",
            "ticker": "Find the ticker of the stock discussed in this document (if any). The format should be like this: 'AAPL'.",
            "keywords": "Give 5-10 keywords that describe the document.",
            "source_name": "Find the source of this document. This should be one of the following: sec_filings, earning_call, investor_relations_release, other_third_party, internal",
            "friendly_name": "Provide a friendly name for this document. The friendly name should indicate source, ticker and date. For example: '10-K for AAPL on 2022-01-01' or 'Earning Call for AAPL on 2022-01-01'.",
            "company_name": "Find the name of the company which is the subject of this document. The format should be like this: 'Apple Inc.'.",
        }
        self.metadata_summary_query = "Extract a 3-5 line summary of the document."
        with open(os.path.join(os.path.dirname(__file__), "descriptions/tool_description.md"), "r") as f:
            self.tool_description_template = f.read()

    async def execute(self, file_id: str) -> QueryEngineTool:

        # 1. Build engines to extract metadata
        print("Building doc_search tool ...")

        print(" - building indices ...")
        vector_index = VectorStoreIndex(self.nodes, embed_model=EMBEDDING_MODEL)
        vector_retriever = VectorIndexRetriever(index=vector_index, similarity_top_k=30)
        storage_context = StorageContext.from_defaults()
        storage_context.docstore.add_documents(self.nodes)
        keyword_index = SimpleKeywordTableIndex(
            self.nodes, storage_context=storage_context, llm=FASTLLM
        )
        keyword_retriever = KeywordTableSimpleRetriever(
            index=keyword_index, similarity_top_k=15
        )
        mix_retriever = MixKeywordVectorRetriever(vector_retriever, keyword_retriever)
        recursive_retriever = RecursiveRetriever(
            "vector",
            retriever_dict={
                "vector": mix_retriever,
            },
            node_dict={node.node_id: node for node in self.nodes},
            verbose=False,
        )

        summary_index = SummaryIndex(self.nodes, embed_model=EMBEDDING_MODEL)
        summary_retriever = SummaryIndexRetriever(index=summary_index)
        summary_retriever_tool = RetrieverTool(
            retriever=summary_retriever,
            metadata=ToolMetadata(
                name="temp",
                description="temp"
                )
            )
        summary_query_engine = summary_index.as_query_engine(llm=LLM)
        summary_retriever_result = summary_retriever_tool.call("Summarize the full document.")
        full_node_len = len(summary_retriever_result.content)
        if full_node_len > MAX_CONTEXT_LENGTH:
            print(" - Context length too long ({}k > {}k). Replacing summary index with vector index".format(int(full_node_len/1000), int(MAX_CONTEXT_LENGTH/1000)))
            nb_nodes = len(self.nodes)
            avg_node_len = full_node_len / nb_nodes
            max_nodes = (MAX_CONTEXT_LENGTH / avg_node_len) * 0.9

            summary_index = vector_index
            summary_retriever = VectorIndexRetriever(index=summary_index, similarity_top_k=max_nodes)
            summary_recursive_retriever = RecursiveRetriever(
                "vector",
                retriever_dict={
                    "vector": summary_retriever,
                },
                node_dict={node.node_id: node for node in self.nodes},
                verbose=False,
            )
            node_postprocessors = [
                LLMRerank(choice_batch_size=15, top_n=int(max_nodes*0.75) , llm=FASTLLM),
            ]
            summary_query_engine = RetrieverQueryEngine(
                retriever=summary_recursive_retriever,
                response_synthesizer=get_response_synthesizer(
                    response_mode="tree_summarize", llm=LLM, verbose=False
                ),
                node_postprocessors=node_postprocessors,
            )

        
        node_postprocessors = [
            LLMRerank(choice_batch_size=15, top_n=15, llm=FASTLLM),
        ]
        

        mix_query_engine = RetrieverQueryEngine(
            retriever=recursive_retriever,
            response_synthesizer=get_response_synthesizer(
                response_mode="tree_summarize", llm=LLM, verbose=False
            ),
            node_postprocessors=node_postprocessors,
        )

        

        # 2. Extract metadata from query engines
        print(" - extracting metadata")
        query_to_metadata = {
            self.metadata_summary_query: "summary",
            **{query: name for name, query in self.metadata_queries.items()},
        }

        tasks = {
            query: query_engine.aquery(query)
            for query, query_engine in [
                (self.metadata_summary_query, summary_query_engine),
                *[
                    (query, mix_query_engine)
                    for query in self.metadata_queries.values()
                ],
            ]
        }

        for query, task in tqdm(
            tasks.items(), total=len(tasks), desc="Extracting metadata"
        ):
            response = await task
            self.metadata[query_to_metadata[query]] = response.response

        metadata_description = "\n".join(
            [f"{key}: {value}" for key, value in self.metadata.items()]
        )

        doc_tool_metadata = DocSearchToolMetadata(
            **self.metadata,
            file_id=file_id,
        )

        # 3. Build tools
        print(" - building tools ...")
        semantic_query_engine_tool = QueryEngineTool(
            query_engine=mix_query_engine,
            metadata=ToolMetadata(
                name=_get_tool_name(file_id, "semantic_query_engine"),
                description=self.tool_description_template.format(
                    tool_type_description="Semantic tool. Let's you find relevant information in the document.",
                    tool_usage_description="Use this tool when you need to find specific information in the document described above.",
                    metadata_description=metadata_description,
                    summary=self.metadata['summary']
                )
            ),
        )
        
        summary_query_engine_tool = QueryEngineTool(
            query_engine=summary_query_engine,
            metadata=ToolMetadata(
                name=_get_tool_name(file_id, "summary_query_engine"),
                description=self.tool_description_template.format(
                    tool_type_description="Summary tool. Let's you read the full document.",
                    tool_usage_description="Use this tool when you need to answer questions about the full document.",
                    metadata_description=metadata_description,
                    summary=self.metadata['summary']
                )
            ),
        )

        question_gen = LLMQuestionGenerator.from_defaults(
            llm=FASTLLM,
            prompt_template_str="""
                Follow the example, but instead of giving a question, always prefix the question 
                'Include numbers with units in your response, structure your response.' 
                """
            + DEFAULT_SUB_QUESTION_PROMPT_TMPL,
        )

        sq_query_engine = SubQuestionQueryEngine.from_defaults(
            query_engine_tools=[
                semantic_query_engine_tool,
            ],
            question_gen=question_gen,
            use_async=True,
            llm=LLM,
            verbose=False,
        )

        sub_question_semantic_query_engine_tool = QueryEngineTool(
            query_engine=sq_query_engine,
            metadata=ToolMetadata(
                name=_get_tool_name(file_id, "sub_question_semantic_query_engine"),
                description=self.tool_description_template.format(
                    tool_type_description="Sub question tool. Let's you answer questions about the document.",
                    tool_usage_description="Use this tool when you need to answer more complex questions about the document.",
                    metadata_description=metadata_description,
                    summary=self.metadata['summary']
                )
            ),
        )

        semantic_retriever_tool = RetrieverTool(
            retriever=recursive_retriever,
            metadata=ToolMetadata(
                name=_get_tool_name(file_id, "semantic_retriever"),
                description=self.tool_description_template.format(
                    tool_type_description="Retriever tool. Returns you passages of the document which are relevant to your query.",
                    tool_usage_description="Use this tool when you need to find sources in the document.",
                    metadata_description=metadata_description,
                    summary=self.metadata['summary']
                )
            ),
            node_postprocessors=node_postprocessors,
        )

        
        summary_retriever_tool = RetrieverTool(
            retriever=summary_retriever,
            metadata=ToolMetadata(
                name=_get_tool_name(file_id, "summary_retriever"),
                description=self.tool_description_template.format(
                    tool_type_description="Summary retriever tool. Returns you the full document.",
                    tool_usage_description="Use this tool when you need to read the full document.",
                    metadata_description=metadata_description,
                    summary=self.metadata['summary']
                )
            ),
        )

        print(" - building tool wrapper ...")
        doc_search_tool_wrapper = DocSearchToolWrapper(
            semantic_query_engine_tool=semantic_query_engine_tool, 
            summary_query_engine_tool=summary_query_engine_tool,
            sub_question_semantic_query_engine_tool=sub_question_semantic_query_engine_tool,
            semantic_retriever_tool = semantic_retriever_tool,
            summary_retriever_tool = summary_retriever_tool,
            metadata=doc_tool_metadata,
            name=semantic_query_engine_tool.metadata.name,
            tool_class="DocSearchToolWrapper",
            description=semantic_query_engine_tool.metadata.description
        )

        return doc_search_tool_wrapper


def _get_tool_name(file_id: str, suffix: str) -> str:
    return f"doc_search_{file_id[0:5]}_{suffix}"
