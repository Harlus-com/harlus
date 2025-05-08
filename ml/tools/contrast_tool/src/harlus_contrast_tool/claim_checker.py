from typing import Dict, List, Optional, Literal

from pydantic import BaseModel

from llama_index.core.prompts import PromptTemplate

from llama_index.core import VectorStoreIndex, KeywordTableIndex

from llama_index.core.retrievers import (
    BaseRetriever,
    VectorIndexRetriever,
    KeywordTableSimpleRetriever,
)
from llama_index.core.question_gen import LLMQuestionGenerator
from llama_index.core.query_engine import BaseQueryEngine, SubQuestionQueryEngine, RetrieverQueryEngine
from llama_index.core.response_synthesizers import get_response_synthesizer
from llama_index.core.output_parsers import PydanticOutputParser

from llama_index.core.tools import QueryEngineTool, ToolMetadata

from llama_parse import LlamaParse
from llama_index.llms.openai import OpenAI

from .utils import *
from .mixed_retriever import MixKeywordVectorRetriever


# TODO use subquestion generator to automatically generate questions given prompt
# TODO: compare to info of multiple files (see Multi-Document Agents (V1))
#   - first select which file going to extract info (based on summary of file)
#   - then perform single file analysis
#   - use MetadataFilters
# TODO: add logger
# TODO: run analysis asynchronously for different claims and different questions
# TODO: integrate in contrast analysis work flow
# TODO: optimise code, can greatly simplify it (what should be in class? what should be in workflow?)
# TODO: parse out non standard inputs to avoid hallucination


class SubQuestion(BaseModel):
    sub_question: str
    tool_name: str = "file"


class SubQuestionList(BaseModel):
    items: List[SubQuestion]


class Verdict(BaseModel):
    status: Literal["true", "false", "unknown"]
    explanation: str


SUBQUESTION_PARSER = PydanticOutputParser(output_cls=SubQuestionList)
VERDICT_PARSER = PydanticOutputParser(output_cls=Verdict)


PROMPT_SUBQUESTIONS_TEXT = """\
Claim:{query_str}
List {num_questions} questions that a financial analyst would ask to identify all relevant information that can verify this claim. Make sure that the questions are
- concise, i.e. each question focusses on a different feature of the claim
- precise, i.e. include as much data from the claim as possible
- complete, i.e. search for all aliases of the claim's topic and its key drivers
{output_format}\
Note that "tool_name" should always be "file".
"""
PROMPT_SUBQUESTIONS = PromptTemplate(PROMPT_SUBQUESTIONS_TEXT)


PROMPT_VERDICT_TEXT = """\
You are a fact-verification assistant verifying if a claim made some time ago is correct based on new information.
Based on the following new facts, return whether the claim is 'true', 'false' or 'unknown' due to insufficient evidence.
Support your verdict with a short explanation. For numeric claims:
- Extract the numeric values from the claim and the evidence.
- If they differ, compute the percent error as:
    |(ClaimValue - EvidenceValue) / EvidenceValue| x 100%
Round to one decimal place and state whether the claim over- or understates the metric.
When verifying the claim, make sure to consider all aliases of the claim's topic and its key drivers.

YOU SHOULD ANSWER IN 2-3 CONCISE BULLET POINTS.
"""
PROMPT_VERDICT = PromptTemplate(PROMPT_VERDICT_TEXT)


# TODO make subclass of SubQuestionQueryEngine
class VerdictQueryEnginePipeline:

    @staticmethod
    def build_retriever(
            file_path:str,
        ) -> BaseRetriever:

        # _, _, nodes = await NodePipeline(file_path).execute()
        
        # print("getting single doc query engine from nodes")

        # print(" - building vector index ...")
        # vector_index = VectorStoreIndex(nodes, embed_model=EMBEDDING_MODEL)

        # print(" - building vector retriever ...")
        # vector_retriever = VectorIndexRetriever(index=vector_index, similarity_top_k=5)

        # print(" - building keyword index ...")
        # storage_context = StorageContext.from_defaults()
        # storage_context.docstore.add_documents(nodes)
        # keyword_index = SimpleKeywordTableIndex(
        #     nodes, 
        #     storage_context=storage_context,
        #     llm=self.question_llm,
        # )

        # # print(" - building summary index ...")
        # # summary_index = SummaryIndex(nodes, embed_model=EMBEDDING_MODEL)

        # print(" - building keyword retriever ...")
        # keyword_retriever = KeywordTableSimpleRetriever(
        #     index=keyword_index, similarity_top_k=5
        # )

        # print(" - building mix keyword vector retriever ...")
        # mix_retriever = MixKeywordVectorRetriever(vector_retriever, keyword_retriever)

        # print(" - building recursive keyword vector retriever ...")
        # recursive_retriever = RecursiveRetriever(
        #     "vector",
        #     retriever_dict={
        #         "vector": mix_retriever,
        #     },
        #     node_dict={node.node_id: node for node in nodes},
        #     verbose=False,
        # )

        parser = LlamaParse(result_type="markdown")
        documents = SimpleDirectoryReader(
            input_files=[file_path],
            file_extractor={".pdf": parser},
        ).load_data()

        for i, doc in enumerate(documents):
            # doc.metadata["document_type"] = document_type
            doc.metadata["file_type"] = "pdf"
            doc.metadata["file_path"] = file_path

            if "page_number" not in doc.metadata:
                doc.metadata["page_num"] = i + 1

        index = VectorStoreIndex.from_documents(documents)
        # index = VectorStoreIndex(nodes)

        return index.as_retriever()


    @staticmethod
    def build(
            file_path:str,
            models_config: dict,
            num_questions: int = 5,
        ) -> BaseQueryEngine:

        # TODO make it possible to change number of questions even after persisting tool

        # llm that finds verification questions to extract relevant data for claims
        question_llm = OpenAI(
            model= models_config["question model"]["model_name"],
            temperature=models_config["question model"]["temperature"],
            max_tokens=models_config["question model"]["max_tokens"],
        )

        # llm that answers subquestions
        answer_llm = OpenAI(
            model=models_config["answer model"]["model_name"],
            temperature=models_config["answer model"]["temperature"],
            max_tokens=models_config["answer model"]["max_tokens"],
            # verbose=True
        )

        # llm that compares relevant data to claims
        verification_llm = OpenAI(
            model=models_config["verification model"]["model_name"],
            temperature=models_config["verification model"]["temperature"],
            max_tokens=models_config["verification model"]["max_tokens"],
            system_prompt=PROMPT_VERDICT_TEXT,
            # verbose=True
        )

        retriever = VerdictQueryEnginePipeline.build_retriever(file_path)

        # node_postprocessors = [
        #     # MetadataReplacementPostProcessor(target_metadata_key="window"),
        #     LLMRerank(choice_batch_size=15, top_n=8, llm=self.question_llm),
        # ]

        print(" - building retriever query engine ...")
        mix_query_engine = RetrieverQueryEngine(
            retriever=retriever,
            response_synthesizer=get_response_synthesizer(
                response_mode="tree_summarize",
                llm=answer_llm,
                verbose=False
            ),
            # node_postprocessors=node_postprocessors,
        )

        query_engine_tools = [
            QueryEngineTool(
                query_engine=mix_query_engine,
                metadata=ToolMetadata(
                    # TODO improve description, make sure the tool corresponds to ==> need to make more robust
                    name="file",
                    description="company file",
                ),
            ),
        ]

        question_gen = LLMQuestionGenerator.from_defaults(
            llm=question_llm,
            prompt_template_str=(
                PROMPT_SUBQUESTIONS.format(
                    num_questions=num_questions,
                    output_format=SUBQUESTION_PARSER.get_format_string(),
                )
            ),
        )

        response_synthesizer = get_response_synthesizer(
            llm=verification_llm,
            use_async=True,
            response_mode="compact",
            output_cls=Verdict
        )
        
        return SubQuestionQueryEngine.from_defaults(
            query_engine_tools=query_engine_tools,
            question_gen=question_gen,
            response_synthesizer=response_synthesizer,
        )