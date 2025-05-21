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
)
from llama_index.core.query_engine import RetrieverQueryEngine, SubQuestionQueryEngine
from llama_index.core.postprocessor import LLMRerank
from llama_index.core.question_gen import LLMQuestionGenerator
from llama_index.core.question_gen.prompts import DEFAULT_SUB_QUESTION_PROMPT_TMPL
from typing import List
from llama_index.core.schema import Node

from .config import LLM, EMBEDDING_MODEL, FASTLLM
from .mixed_retriever import MixKeywordVectorRetriever

from pydantic import BaseModel

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
    semantic_tool: QueryEngineTool
    summary_tool: QueryEngineTool
    retriever_tool: RetrieverTool
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

    async def execute(self, file_id: str) -> QueryEngineTool:

        print("getting single doc query engine from nodes")

        print(" - building vector index ...")
        vector_index = VectorStoreIndex(self.nodes, embed_model=EMBEDDING_MODEL)

        print(" - building vector retriever ...")
        vector_retriever = VectorIndexRetriever(index=vector_index, similarity_top_k=15)

        print(" - building keyword index ...")
        storage_context = StorageContext.from_defaults()
        storage_context.docstore.add_documents(self.nodes)
        keyword_index = SimpleKeywordTableIndex(
            self.nodes, storage_context=storage_context, llm=FASTLLM
        )

        print(" - building summary index ...")
        summary_index = SummaryIndex(self.nodes, embed_model=EMBEDDING_MODEL)

        print(" - building keyword retriever ...")
        keyword_retriever = KeywordTableSimpleRetriever(
            index=keyword_index, similarity_top_k=8
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
            LLMRerank(choice_batch_size=15, top_n=8, llm=FASTLLM),
        ]

        print(" - building mix keyword vector retriever query engine ...")
        mix_query_engine = RetrieverQueryEngine(
            retriever=recursive_retriever,
            response_synthesizer=get_response_synthesizer(
                response_mode="tree_summarize", llm=LLM, verbose=False
            ),
            node_postprocessors=node_postprocessors,
        )

        print(" - building summary index query engine...")
        summary_query_engine = summary_index.as_query_engine(
            llm=LLM,
        )

        print(" - extracting metadata from query engines...")
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

        print(" - building mix retriever query engine tool...")
        metadata_description = "\n".join(
            [f"{key}: {value}" for key, value in self.metadata.items()]
        )

        print("this is metadata", self.metadata)
        mix_query_engine_tool = QueryEngineTool(
            query_engine=mix_query_engine,
            metadata=ToolMetadata(
                name=_get_tool_name(file_id, "semantic"),
                description=f""" 
# Tool type:

Semantic tool. Let's you find relevant information in the document.

# Document information:

{metadata_description}

# Document summary:
{self.metadata['summary']}

# When you should use this tool:

Use this tool when you need to find specific information in the document described above.
""",
            ),
        )

        doc_tool_metadata = DocSearchToolMetadata(
            **self.metadata,
            file_id=file_id,
        )

        print(" - building summary query engine tool...")
        summary_query_engine_tool = QueryEngineTool(
            query_engine=summary_query_engine,
            metadata=ToolMetadata(
                name=_get_tool_name(file_id, "summary"),
                description=f""" 
# Tool type:

Summary tool. Let's you read the full document.

# Document information:

{metadata_description}

# Document summary:
{self.metadata['summary']}
                """,
            ),
        )

        print(" - building question generator ...")
        question_gen = LLMQuestionGenerator.from_defaults(
            llm=FASTLLM,
            prompt_template_str="""
                Follow the example, but instead of giving a question, always prefix the question 
                'Include numbers with units in your response, structure your response.' 
                """
            + DEFAULT_SUB_QUESTION_PROMPT_TMPL,
        )

        print(" - building sub question query engine ...")
        sq_query_engine = SubQuestionQueryEngine.from_defaults(
            query_engine_tools=[
                summary_query_engine_tool,
            ],
            question_gen=question_gen,
            use_async=True,
            llm=LLM,
            verbose=False,
        )

        sq_query_engine_tool = QueryEngineTool(
            query_engine=sq_query_engine,
            metadata=ToolMetadata(
                name=_get_tool_name(file_id, "summary"),
                description=f""" 
# Tool type:

Summary tool. Let's you read the full document.

# Document information:

{metadata_description}

# Document summary:
{self.metadata['summary']}

# When you should use this tool:

Use this tool only when you need to read the full document described above.
                """,
            ),
        )

        retriever_tool = RetrieverTool(
            retriever=recursive_retriever,
            metadata=ToolMetadata(
                name=_get_tool_name(file_id, "retriever"),
                description=f"""
# Tool type:

Retriever tool. Returns you passages of the document which are relevant to your query.

# Document information:

{metadata_description}

# Document summary:
{self.metadata['summary']}

# When you should use this tool:

Use this tool when you need to find sources in the document.""",
            ),
            node_postprocessors=node_postprocessors,
        )

        doc_search_tool_wrapper = DocSearchToolWrapper(
            semantic_tool=mix_query_engine_tool,
            summary_tool=sq_query_engine_tool,
            retriever_tool=retriever_tool,
            metadata=doc_tool_metadata,
            name=mix_query_engine_tool.metadata.name,
            tool_class="DocSearchToolWrapper",
            description=mix_query_engine_tool.metadata.description,
        )

        return doc_search_tool_wrapper


def _get_tool_name(file_id: str, suffix: str) -> str:
    return f"doc_search_{file_id[0:5]}_{suffix}"
