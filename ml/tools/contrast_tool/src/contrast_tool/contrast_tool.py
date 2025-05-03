import os, json

from .claim_getter import ClaimGetter
from .claim_checker import ClaimCheckerPipeline

from llama_index.core.output_parsers import PydanticOutputParser

from llama_index.core.retrievers import BaseRetriever
from llama_index.core.base.base_query_engine import BaseQueryEngine

from pydantic import BaseModel

from .utils import find_fuzzy_bounding_boxes

from .prompts import get_prompt

from typing import List, Tuple, Literal

import fitz

DEFAULT_CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config.yaml")


class Claim(BaseModel):
    text: str
    source: str
    page_num: int
    bounding_box: List[Tuple[float, float, float, float]]
    # page_width: float
    # page_height: float

    @classmethod
    def from_rect(cls, text: str, page: int, rects: List[fitz.Rect]):
        boxes = [(r.x0, r.y0, r.x1, r.y1) for r in rects]
        return cls(text=text, page=page, bouding_boxes=boxes)
    

class Source(BaseModel):
    text: str
    file_name: str
    page_num: int


class Verdict(BaseModel):
    status: Literal["true", "false", "unknown"]
    explanation: str
    source: Source


class ContrastTool:
    # def __init__(self):

        # config = load_config(DEFAULT_CONFIG_PATH)

        # self.getter = ClaimGetter(
        #     config["claim getter"],
        # )

        # # self.checker = ClaimChecker(config["claim checker"])
        # self.checker = await ClaimCheckerPipeline(config["claim checker"]).

    def get_name(self):
        return "contrast_tool"

    # def get_sources(claims: list[str], doc_retriever: BaseRetriever):

    #     return

    # def compare_documents_from_path(self, old_file: str, new_file: str):

    #     print(f"\nExtracting claims from old document: {old_file}")

    #     claims = self.getter.extract_from_path(old_file)
    #     claims_text = [claim.text for claim in claims]
    #     for claim in claims_text:
    #         print(f"Claim: {claim}")

    #     print(f"\nAnalyzing claims against new document: {new_file}")
    #     verdict = self.checker.analyse_from_path(claims_text, new_file)

    #     print("\nVerdict:")
    #     print(json.dumps(verdict, indent=2))

    #     output = {}
    #     for claim in claims:
    #         output[claim.text] = {
    #             "page_num": claim.page_num,
    #             "bbox": claim.bounding_box,
    #             "verdict": verdict[claim.text]["verdict"],
    #             "explanation": verdict[claim.text]["explanation"],
    #         }

    #     return output


    # def claim_to_questions(self, claim: str, num_questions: int = 3) -> list[str]:

    #     prompt = get_prompt("get questions to challenge claim")
    #     questions_to_verify = self.question_llm.complete(
    #         prompt.format(
    #             claim=claim,
    #             num_questions=num_questions,
    #             output_format=self.question_parser.get_format_string(),
    #         )
    #     )
    #     parsed_questions = self.question_parser.parse(
    #         questions_to_verify.text
    #     ).questions

    #     return parsed_questions


    # def questions_to_data(
    #         self,
    #         questions: list[str], 
    #         retriever: BaseRetriever
    #     ) -> str:

    #     evidence_blocks = []
    #     nodes_seen = []
    #     # TODO can happen asynchronously
    #     for question in questions:
    #         for hit in retriever.retrieve(question):
    #             if hit.node.node_id not in nodes_seen:
    #                 nodes_seen.append(hit.node.node_id)
    #                 evidence_blocks.append(hit.node.get_content())

    #     evidence = "\n\n".join(
    #         f"Evidence {i+1}:\n{"-" * 40}\n{blok}"
    #         for i, blok in enumerate(evidence_blocks)
    #     )

    #     return evidence
    

    # def compare_claim_to_data(self, claim: str, data: str) -> str:

    #     prompt = get_prompt("verify claim with data")
    #     verification = self.verification_llm.complete(
    #         prompt.format(
    #             claim=claim,
    #             data=data,
    #             output_format=self.verification_parser.get_format_string(),
    #         )
    #     )
    #     parsed_verification = self.verification_parser.parse(verification.text)

    #     return parsed_verification
    

    def extract_claims(
            self,
            thesis_retriever,
            thesis_path,
            thesis_qengine: BaseQueryEngine,
        ) -> dict:

        try:
            output = {}

            claims = self.getter.extract(old_doc_qengine, old_doc_retriever, old_file_path)

            # TODO can run asynchronously
            for claim in claims:

                # TODO remove questions, just query engine directly
                # TODO add a query enhancer right before query engine (that says consider all drivers of the lcaim etc.)
                verification = checker_qengine.query(claim)

                # extract bounding box of claims
                # 

                output[claim] = {
                    "text": verification.verdict,
                    "explanation": verification.reasoning,
                }

                claims.append(
                Claim(
                    text=claim,
                    source=source,
                    page_num=page_num,
                    bounding_box=bbox,
                    # Using first page's dimensions for now TODO: Set per page
                    page_width=doc[0].rect.width,
                    page_height=doc[0].rect.height,
                )
            )

            return output

        except Exception as e:
            return {"error": str(e)}
        

    def analyse_claims(
            self,
            claims: list[str],
            # checker_retriever: BaseRetriever,
            checker_qengine: BaseQueryEngine,
        ) -> dict:

        try:
            output = {}

            # TODO can run asynchronously
            for claim in claims:

                # TODO remove questions, just query engine directly
                # TODO add a query enhancer right before query engine (that says consider all drivers of the lcaim etc.)
                verdict = checker_qengine.query(claim)
                parsed_verdict = PydanticOutputParser(output_cls=Verdict).parse(verdict.text)

                # extract bounding box of sources
                boxes = find_fuzzy_bounding_boxes()

                output[claim] = {
                    "questions": verdict.,
                    "verdict": verdict.text,
                    "explanation": verdict.explanation,
                    "source": {
                        "file_path": ,
                        "page_num": ,
                        "bounding_box": ,
                    },
                }

            return output

        except Exception as e:
            return {"error": str(e)}


    def compare_documents(
        self,
        old_file_path: str,
        new_file_path: str,
        old_doc_qengine: BaseQueryEngine,
        old_doc_retriever: BaseRetriever,
        new_doc_retriever: BaseRetriever,
    ):
        print(f"\nExtracting claims from old document: {old_file_path}")

        claims = 
        claims_text = [claim.text for claim in claims]

        # claims = self.extract_claims(old_doc)
        for claim in claims_text:
            print(f"Claim: {claim}")

        print(f"\nAnalyzing claims against new document: {new_file_path}")
        

        verdict = self.checker.analyse_from_retriever(claims_text, new_doc_retriever)

        # print("\nVerdict:")
        # print(json.dumps(verdict, indent=4))

        output = {}
        for claim in claims:
            output[claim.text] = {
                "page_num": claim.page_num,
                "bbox": claim.bounding_box,
                "verdict": verdict[claim.text]["verdict"],
                "explanation": verdict[claim.text]["explanation"],
                "page_width": claim.page_width,
                "page_height": claim.page_height,
            }

        return output
