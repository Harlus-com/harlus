from llama_index.core.retrievers import BaseRetriever
from llama_index.core.base.base_query_engine import BaseQueryEngine

from typing import List

from .api_interfaces import *
from .claim_getter import CLAIM_PARSER, PROMPT_GET_CLAIMS_TEXT


class ContrastTool:

    def get_name(self):
        return "contrast_tool"


    @staticmethod
    def extract_claims(
            file_path: str,
            file_sentence_retriever: BaseRetriever,
            file_qengine: BaseQueryEngine,
        ) -> List[Claim]:

        # TODO integrate parser in query engine
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
    

    @staticmethod
    def run(
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
