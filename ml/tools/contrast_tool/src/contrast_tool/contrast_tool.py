import os, json

from .claim_getter import ClaimGetterPipeline, CLAIM_PARSER
from .claim_checker import ClaimCheckerPipeline, VERDICT_PARSER

from llama_index.core.output_parsers import PydanticOutputParser

from llama_index.core.retrievers import BaseRetriever
from llama_index.core.base.base_query_engine import BaseQueryEngine

from .utils import find_fuzzy_bounding_boxes

from .prompts import get_prompt

from typing import List, Tuple, Literal

import fitz
from pydantic import BaseModel

# DEFAULT_CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config.yaml")

from .api_interfaces import *


PROMPT_GET_CLAIMS_TEXT = f"""\
Considering the date of the report, what are *all* the sentences in this report that express a projection, an outlook or an expectation about company KPIs or market characteristics? \
Write one precise sentence per item, each time mentioning the topic, the expected value or trend and the period or horizon date. \
Rely on the date of the report to make precise time-related claims. Instead of writing "this year" or "next quarter", specify the year or the quarter. \
Use *only* figures that appear in the text. Do not invent anything.
{CLAIM_PARSER.get_format_string()}
"""


class ContrastTool:

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
    
    @staticmethod
    def get_highlight_area(
        claim: str,
        file_path: str,
        file_sentence_retriever: BaseRetriever,
    ) -> HighlightArea:
        # TODO can highlight on several pages
        # TODO highlight several sentences related to the claim
        # TODO move to utils

        # sentence that matches the claim
        sentence = file_sentence_retriever.retrieve(claim)
        source = " ".join(sentence[0].get_content().split())
        page_num = int(sentence[0].node.metadata.get("page_label"))

        bbox = find_fuzzy_bounding_boxes(file_path, source, page_num) or []

        return HighlightArea(bounding_boxes=bbox, jump_to_page=page_num)


    @staticmethod
    def extract_claims(
            # self,
            file_path: str,
            file_sentence_retriever: BaseRetriever,
            file_qengine: BaseQueryEngine,
        ) -> List[Claim]:

        claims = file_qengine.query(PROMPT_GET_CLAIMS_TEXT)
        parsed_claims = CLAIM_PARSER.parse(claims.response).claims

        # TODO can run asynchronously
        claim_list: List[Claim] =[]
        for claim in parsed_claims:

            hl_area = ContrastTool.get_highlight_area(
                claim.text,
                file_path,
                file_sentence_retriever,
            )

            claim_list.append(
                Claim(
                    text=claim.text,
                    file_path=file_path,
                    highlight_area=hl_area,
                )
            )
            
        return claim_list


    @staticmethod
    def analyse_claims(
            claims: List[Claim],
            file_path: str,
            file_sentence_retriever: BaseRetriever,
            file_qengine: BaseQueryEngine,
        ) -> List[Verdict]:

        verdict_list = {}

        # TODO can run asynchronously
        verdict_list: List[Verdict] = []
        for claim in claims:
            
            verdict = file_qengine.query(claim.text)
            parsed_verdict = VERDICT_PARSER.parse(verdict.response)
            
            # if parsed_verdict.status not "unknown":
        
            #     hl_area = ContrastTool.get_highlight_area(
            #         claim.text,
            #         file_path,
            #         file_sentence_retriever,
            #     )

            #     verdict_list.append(
            #         Verdict(
            #             claim=claim.text,
            #             status=,
            #             explanation=,
            #             evidence_file_path= ,
            #             evidence_highlight_area=
            #         )
            #     )

            # # extract bounding box of sources
            # bboxes = find_fuzzy_bounding_boxes(
            #     verdict.source.file_path,
            #     verdict.source.text,
            #     verdict.source.page_num,
            # )

            # output[claim] = {
            #     # "questions": verdict,
            #     "status": verdict.status,
            #     "explanation": verdict.explanation,
            #     "source": {
            #         "file_path": [verdict.source.file_path],
            #         "page_num": [verdict.source.page_num],
            #         "bounding_box": bboxes,
            #     },
            # }

        return verdict_list
    

    def run(
        self,
        # thesis_path: str,
        thesis_qengine: BaseQueryEngine,
        # thesis_retriever: BaseRetriever,
        # update_path: str,
        update_qengine: BaseQueryEngine,
        # update_retriever: BaseRetriever,
    ):
        claims = ContrastTool.extract_claims(thesis_qengine)
        
        for claim in claims:
            print(f"Claim: {claim}")

        verdicts = ContrastTool.analyse_claims(claims, update_qengine)

        for verdict in verdicts:
            print(verdict)

        print("\nVerdict:")
        print(json.dumps(verdict, indent=4))

        output: List[Claim] = []
        for claim in claims:
            output.append(
                Claim(
                    text=verdict[claim]["explanation"], # message to put in comment box
                    page_num=claim["page_num"],
                    bounding_boxes=claim["bounding_box"],
                    sources=(
                        Source(
                            file_path= "",
                            page_num= 0,
                            bounding_boxes= [[0,0,0,0]],
                        )
                    )
                    # Using first page's dimensions for now TODO: Set per page
                    # page_width=doc[0].rect.width,
                    # page_height=doc[0].rect.height,
                )
            )

        return output
