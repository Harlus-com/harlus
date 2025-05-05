from typing import Dict, List, Optional, Literal

from llama_index.core.prompts import PromptTemplate
from pydantic import BaseModel

from llama_index.core import VectorStoreIndex, KeywordTableIndex

# from llama_index.extractors.entity import EntityExtractor
from llama_index.core.retrievers import (
    BaseRetriever,
    VectorIndexRetriever,
    KeywordTableSimpleRetriever,
)
from llama_index.core.query_engine import BaseQueryEngine, SubQuestionQueryEngine, RetrieverQueryEngine
from llama_index.core.response_synthesizers import (
    BaseSynthesizer,
    get_response_synthesizer,
)
from llama_index.core.output_parsers import PydanticOutputParser

from llama_index.core.tools import QueryEngineTool, ToolMetadata

from llama_index.core.question_gen import LLMQuestionGenerator

from llama_index.core.node_parser import SentenceWindowNodeParser

from llama_index.readers.file import PDFReader

from llama_parse import LlamaParse
from llama_index.llms.openai import OpenAI

from .utils import *
from .mixed_retriever import MixKeywordVectorRetriever

from .prompts import get_prompt
import src.contrast_tool.prompts as prompts

from pathlib import Path


# TODO prevent hallucinations -> add to prompt that "if no info, say no info"
# TODO use subquestion generator to automatically generate questions given prompt
# TODO: compare to info of multiple files (see Multi-Document Agents (V1))
#   - first select which file going to extract info (based on summary of file)
#   - then perform single file analysis
#   - use MetadataFilters
# TODO: add logger
# TODO: run analysis asynchronously for different claims and different questions
# TODO: cache document indices
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

# class VerdictList(BaseModel):
#     verdicts: List[Verdict]   


SUBQUESTION_PARSER = PydanticOutputParser(output_cls=SubQuestionList)
VERDICT_PARSER = PydanticOutputParser(output_cls=Verdict)

PROMPT_SUBQUESTIONS_TEXT = """\
Claim:
{query_str}

List {num_questions} questions that a financial analyst would ask to identify all relevant information that can verify this claim. Make sure that the questions are
- concise, i.e. each question focusses on a different feature of the claim
- precise, i.e. include as much data from the claim as possible
- complete, i.e. search for all aliases of the claim's topic and its key drivers

{output_format}\
Note that "tool_name" should always be "file".
"""
PROMPT_SUBQUESTIONS = PromptTemplate(PROMPT_SUBQUESTIONS_TEXT)

PROMPT_VERDICT_TEXT = """\
You are a fact-verification assistant verifying a claim made some time ago.
Based on the following new facts, return whether the claim is 'true', 'false' or 'unknown' due to insufficient evidence.
Support your verdict with a short explanation. For numeric claims:
- Extract the numeric values from the claim and the evidence.
- If they differ, compute the percent error as:
    |(ClaimValue - EvidenceValue) / EvidenceValue| x 100%
Round to one decimal place and state whether the claim over- or understates the metric.
When verifying the claim, make sure to consider all aliases of the claim's topic and its key drivers.

{output_format}\
"""
PROMPT_VERDICT = PromptTemplate(PROMPT_VERDICT_TEXT)

# TODO make subclass of query engine
class ClaimCheckerPipeline:

    def __init__(
        self,
        config: dict,
    ):
        # llm that finds verification questions to extract relevant data for claims
        # self.question_model_name = config["question model"]["model_name"]
        # self.question_parser = PydanticOutputParser(output_cls=ExtractQuestions)
        self.question_llm = OpenAI(
            model= config["question model"]["model_name"],
            temperature=config["question model"]["temperature"],
            max_tokens=config["question model"]["max_tokens"],
        )

        # llm that compares relevant data to claims
        # self.verification_model_name = config["verification model"]["model_name"]
        # self.verification_parser = PydanticOutputParser(output_cls=Verdict)
        self.verification_llm = OpenAI(
            model=config["verification model"]["model_name"],
            temperature=config["verification model"]["temperature"],
            max_tokens=config["verification model"]["max_tokens"],
            system_prompt=PROMPT_VERDICT.format(output_format=VERDICT_PARSER.get_format_string()),
            # output_parser=VERDICT_PARSER
        )


    def build_sentence_retriever(self, file_path: str):

        docs = PDFReader().load_data(file=file_path)
        splitter = SentenceWindowNodeParser.from_defaults(
            window_size=1,
            window_metadata_key="window",
            original_text_metadata_key="sentence",
        )
        index = VectorStoreIndex.from_documents(docs, transformations=[splitter])

        return index.as_retriever(similarity_top_k=1)


    def build_retriever(
            self, 
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


    def build_qengine(
            self, 
            file_path:str,
            num_questions: int = 3,
        ) -> BaseQueryEngine:

        retriever = self.build_retriever(file_path)

        # node_postprocessors = [
        #     # MetadataReplacementPostProcessor(target_metadata_key="window"),
        #     LLMRerank(choice_batch_size=15, top_n=8, llm=self.question_llm),
        # ]

        print(" - building retriever query engine ...")
        mix_query_engine = RetrieverQueryEngine(
            retriever=retriever,
            response_synthesizer=get_response_synthesizer(
                response_mode="tree_summarize",
                llm=self.verification_llm,
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
            llm=self.question_llm,
            prompt_template_str=(
                PROMPT_SUBQUESTIONS.format(
                    num_questions=num_questions,
                    output_format=SUBQUESTION_PARSER.get_format_string(),
                )
            ),
        )

        response_synthesizer = get_response_synthesizer(
            llm=self.verification_llm,
            # prompt_template=,
            use_async=True,
            # verbose=True,
        )
        
        return SubQuestionQueryEngine.from_defaults(
            query_engine_tools=query_engine_tools,
            question_gen=question_gen,
            response_synthesizer=response_synthesizer,
        )


# # # TODO pipeline
# class ClaimChecker:

#     def __init__(
#         self,
#         config: Dict,
#     ):
#         # llm that finds verification questions to extract relevant data for claims
#         self.question_model_name = config["question model"]["model_name"]
#         self.question_parser = PydanticOutputParser(output_cls=ExtractQuestions)
#         self.question_llm = OpenAI(
#             model=self.question_model_name,
#             temperature=config["question model"]["temperature"],
#             max_tokens=config["question model"]["max_tokens"],
#         )

#         # llm that compares relevant data to claims
#         self.verification_model_name = config["verification model"]["model_name"]
#         self.verification_parser = PydanticOutputParser(output_cls=VerificationResponse)
#         self.verification_llm = OpenAI(
#             model=self.verification_model_name,
#             temperature=config["verification model"]["temperature"],
#             max_tokens=config["verification model"]["max_tokens"],
#         )

#     def claim_to_questions(self, claim: str, num_questions: int = 3) -> List[str]:

#         prompt = get_prompt("get questions to challenge claim")
#         questions_to_verify = self.question_llm.complete(
#             prompt.format(
#                 claim=claim,
#                 num_questions=num_questions,
#                 output_format=self.question_parser.get_format_string(),
#             )
#         )
#         parsed_questions = self.question_parser.parse(
#             questions_to_verify.text
#         ).questions

#         return parsed_questions

#     def questions_to_data(self, questions: List[str], retriever: BaseRetriever) -> str:

#         evidence_blocks = []
#         nodes_seen = []
#         # can happen asynchronously
#         for question in questions:
#             for hit in retriever.retrieve(question):
#                 if hit.node.node_id not in nodes_seen:
#                     nodes_seen.append(hit.node.node_id)
#                     evidence_blocks.append(hit.node.get_content())

#         evidence = "\n\n".join(
#             f"Evidence {i+1}:\n{"-" * 40}\n{blok}"
#             for i, blok in enumerate(evidence_blocks)
#         )

#         return evidence

#     def compare_claim_to_data(self, claim: str, data: str) -> str:

#         prompt = get_prompt("verify claim with data")
#         verification = self.verification_llm.complete(
#             prompt.format(
#                 claim=claim,
#                 data=data,
#                 output_format=self.verification_parser.get_format_string(),
#             )
#         )
#         parsed_verification = self.verification_parser.parse(verification.text)

#         return parsed_verification

#     # TODO replace this with file query engine
#     def build_retriever(self, file_path: str) -> BaseRetriever:

#         documents = load_document(file_path, "source")

#         vector_index = VectorStoreIndex.from_documents(documents)
#         keyword_index = KeywordTableIndex.from_documents(documents)

#         vector_retriever = VectorIndexRetriever(index=vector_index, similarity_top_k=3)
#         keyword_retriever = KeywordTableSimpleRetriever(index=keyword_index)
#         mixed_retriever = MixKeywordVectorRetriever(vector_retriever, keyword_retriever)

#         return mixed_retriever

#     # def analyse_from_path(self, claims: list[str], file_path: str) -> Dict:

#     #     documents = load_document(file_path, "source")

#     #     vector_index = VectorStoreIndex.from_documents(documents)
#     #     keyword_index = KeywordTableIndex.from_documents(documents)

#     #     vector_retriever = VectorIndexRetriever(index=vector_index, similarity_top_k=3)
#     #     keyword_retriever = KeywordTableSimpleRetriever(index=keyword_index)
#     #     mixed_retriever = MixKeywordVectorRetriever(vector_retriever, keyword_retriever)

#     #     try:
#     #         output = {}

#     #         # can run asynchronously
#     #         for i, claim in enumerate(claims):
#     #             questions = self.claim_to_questions(claim, num_questions=3)
#     #             data = self.questions_to_data(questions, mixed_retriever)
#     #             verification = self.compare_claim_to_data(claim, data)

#     #             output[claim] = {
#     #                 "questions": questions,
#     #                 "verdict": verification.verdict,
#     #                 "explanation": verification.reasoning,
#     #             }

#     #         return output

#     #     except Exception as e:
#     #         return {"error": str(e)}


#     def analyse_from_retriever(self, claims: list[str], retriever: BaseRetriever):

#         try:
#             output = {}

#             # TODO can run asynchronously
#             for i, claim in enumerate(claims):

#                 # TODO remove questions, just query engine directly
#                 # TODO add a query enhancer right before query engine (that says consider all drivers of the lcaim etc.)
#                 questions = self.claim_to_questions(claim, num_questions=3)
#                 data = self.questions_to_data(questions, retriever)
#                 verification = self.compare_claim_to_data(claim, data)

#                 # get sources

#                 output[claim] = {
#                     "questions": questions,
#                     "verdict": verification.verdict,
#                     "explanation": verification.reasoning,
#                 }

#             return output

#         except Exception as e:
#             return {"error": str(e)}


    