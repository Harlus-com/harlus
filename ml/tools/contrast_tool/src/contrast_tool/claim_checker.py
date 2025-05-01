from typing import Dict, List, Optional, Literal

from pydantic import BaseModel

from llama_index.core import VectorStoreIndex, KeywordTableIndex

# from llama_index.extractors.entity import EntityExtractor
from llama_index.core.retrievers import (
    BaseRetriever,
    VectorIndexRetriever,
    KeywordTableSimpleRetriever,
)
from llama_index.core.output_parsers import PydanticOutputParser

from llama_index.core.tools import QueryEngineTool

from llama_index.llms.openai import OpenAI

from .utils import *
from .doc_search_copy.mixed_retriever import MixKeywordVectorRetriever

from .prompts import get_prompt

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


class ExtractQuestions(BaseModel):
    questions: List[str]

class VerificationResponse(BaseModel):
    verdict: Literal["True", "False", "Insufficient evidence"]
    reasoning: str


# TODO pipeline
class ClaimChecker:

    def __init__(
        self,
        config: Dict,
    ):
        # llm that finds verification questions to extract relevant data for claims
        self.question_model_name = config["question model"]["model_name"]
        self.question_parser = PydanticOutputParser(output_cls=ExtractQuestions)
        self.question_llm = OpenAI(
            model=self.question_model_name, 
            temperature=config["question model"]["temperature"], 
            max_tokens=config["question model"]["max_tokens"]
        )
        
        # llm that compares relevant data to claims
        self.verification_model_name = config["verification model"]["model_name"]
        self.verification_parser = PydanticOutputParser(output_cls=VerificationResponse)
        self.verification_llm = OpenAI(
            model=self.verification_model_name, 
            temperature=config["verification model"]["temperature"], 
            max_tokens=config["verification model"]["max_tokens"]
        )


    def claim_to_questions(self, claim: str, num_questions: int = 3) -> List[str]:

        prompt = get_prompt("get questions to challenge claim")
        questions_to_verify = self.question_llm.complete(
            prompt.format(claim=claim, num_questions=num_questions, output_format=self.question_parser.get_format_string())
        )
        parsed_questions = self.question_parser.parse(questions_to_verify.text).questions
        
        return parsed_questions


    def questions_to_data(self, questions: List[str], retriever: BaseRetriever) -> str:

        evidence_blocks = []
        nodes_seen = []
        # can happen asynchronously
        for question in questions:
            for hit in retriever.retrieve(question):
                if hit.node.node_id not in nodes_seen:
                    nodes_seen.append(hit.node.node_id)
                    evidence_blocks.append(hit.node.get_content())

        evidence = "\n\n".join(f"Evidence {i+1}:\n{"-" * 40}\n{blok}" for i, blok in enumerate(evidence_blocks))

        return evidence
    

    def compare_claim_to_data(self, claim: str, data: str) -> str:

        prompt = get_prompt("verify claim with data")
        verification = self.verification_llm.complete(
            prompt.format(claim=claim, data=data, output_format=self.verification_parser.get_format_string())
        )
        parsed_verification = self.verification_parser.parse(verification.text)

        return parsed_verification


    # TODO replace this with file query engine
    def build_retriever(self, file_path: str) -> BaseRetriever:

        documents = load_document(file_path, 'source')

        vector_index = VectorStoreIndex.from_documents(documents)
        keyword_index = KeywordTableIndex.from_documents(documents)

        vector_retriever = VectorIndexRetriever(index=vector_index, similarity_top_k=3)
        keyword_retriever = KeywordTableSimpleRetriever(index=keyword_index)
        mixed_retriever = MixKeywordVectorRetriever(vector_retriever, keyword_retriever)
        
        return mixed_retriever
    

    def analyse_from_path(self, claims: list[str], file_path: str) -> Dict:
        
        documents = load_document(file_path, 'source')

        vector_index = VectorStoreIndex.from_documents(documents)
        keyword_index = KeywordTableIndex.from_documents(documents)

        vector_retriever = VectorIndexRetriever(index=vector_index, similarity_top_k=3)
        keyword_retriever = KeywordTableSimpleRetriever(index=keyword_index)
        mixed_retriever = MixKeywordVectorRetriever(vector_retriever, keyword_retriever)

        try:
            output = {}

            # can run asynchronously
            for i, claim in enumerate(claims):

                # TODO remove questions, just query engine directly
                # TODO add a query enhancer right before query engine (that says consider all drivers of the lcaim etc.)
                questions = self.claim_to_questions(claim, num_questions=3)
                data = self.questions_to_data(questions, mixed_retriever)
                verification = self.compare_claim_to_data(claim, data)

                output[claim] = {
                    "questions": questions,
                    "verdict": verification.verdict,
                    "explanation": verification.reasoning,
                }

            return output
        
        except Exception as e:
            return {"error": str(e)}
        



    # def analyse(self, claims: list[str], doc_wrapper: QueryEngineTool) -> Dict:
        
    #     # documents = load_document(req.file_path, 'source')

    #     # vector_index = VectorStoreIndex.from_documents(documents)
    #     # keyword_index = KeywordTableIndex.from_documents(documents)

    #     # vector_retriever = VectorIndexRetriever(index=vector_index, similarity_top_k=3)
    #     # keyword_retriever = KeywordTableSimpleRetriever(index=keyword_index)
    #     # mixed_retriever = MixKeywordVectorRetriever(vector_retriever, keyword_retriever)

    #     retriever = doc_wrapper.doc_tool.query_engine._query_engines['mix_qengine'].retriever

    #     self.analyse_from_retriever(retriever)


    def analyse_from_retriever(self, claims: list[str], retriever: BaseRetriever):

        try:
            output = {}

            # TODO can run asynchronously
            for i, claim in enumerate(claims):

                # TODO remove questions, just query engine directly
                # TODO add a query enhancer right before query engine (that says consider all drivers of the lcaim etc.)
                questions = self.claim_to_questions(claim, num_questions=3)
                data = self.questions_to_data(questions, retriever)
                verification = self.compare_claim_to_data(claim, data)

                # get sources


                output[claim] = {
                    "questions": questions,
                    "verdict": verification.verdict,
                    "explanation": verification.reasoning,
                }

            return output
        
        except Exception as e:
            return {"error": str(e)}

