import os, json

from .claim_getter import ClaimQueryEnginePipeline, CLAIM_PARSER
from .claim_checker import VerdictQueryEnginePipeline, VERDICT_PARSER

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


    @staticmethod
    def get_highlight_area(
        sentence: str,
        file_path: str,
        file_sentence_retriever: BaseRetriever,
    ) -> HighlightArea:
        # TODO can highlight on several pages
        # TODO highlight several sentences related to the claim
        # TODO move to utils

        # sentence that matches the claim
        sentence = file_sentence_retriever.retrieve(sentence)
        source = " ".join(sentence[0].get_content().split())
        page_num = int(sentence[0].node.metadata.get("page_label"))

        bbox = find_fuzzy_bounding_boxes(file_path, source, page_num) or []

        return HighlightArea(bounding_boxes=bbox, jump_to_page=page_num)


    @staticmethod
    def extract_claims(
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
        ) -> List[ClaimComment]:

        verdict_list = {}

        # TODO can run asynchronously
        comments: List[ClaimComment] = []
        for claim in claims:

            verdict = file_qengine.query(claim.text)
            # parsed_verdict = VERDICT_PARSER.parse(verdict.response)
            
            print(verdict)

            if verdict.status != "unknown":
        
                hl_area = ContrastTool.get_highlight_area(
                    verdict.explanation,
                    file_path,
                    file_sentence_retriever,
                )

                links = [LinkComment(
                    file_path = file_path,
                    highlight_area = hl_area
                )]
            else:
                links = []

            comments.append(
                ClaimComment(
                    file_path = claim.file_path,
                    text = verdict.explanation,
                    highlight_area = claim.highlight_area,
                    links = links,
                    verdict = verdict.status
                )
            )

        return comments
    

    def run(
        self,
        thesis_path: str,
        thesis_qengine: BaseQueryEngine,
        thesis_sentence_retriever: BaseRetriever,
        update_path: str,
        update_qengine: BaseQueryEngine,
        update_sentence_retriever: BaseRetriever,
    ) -> List[ClaimComment]:
        
        claims = ContrastTool.extract_claims(
            thesis_path,
            thesis_sentence_retriever,
            thesis_qengine,
        )
        
        return ContrastTool.analyse_claims(
            claims,
            update_path,
            update_sentence_retriever,
            update_qengine
        )
