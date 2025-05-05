from pydantic import BaseModel, Field
from typing import List, Tuple

from llama_index.llms.openai import OpenAI
from llama_index.core.output_parsers import PydanticOutputParser
from llama_index.core import VectorStoreIndex
from llama_index.core.node_parser import SentenceWindowNodeParser

from llama_index.core.tools import QueryEngineTool
from llama_index.core.retrievers import BaseRetriever
from llama_index.core.base.base_query_engine import BaseQueryEngine

from llama_index.readers.file import PDFReader

from llama_index.core import get_response_synthesizer

from .utils import *

from .prompts import get_prompt

from llama_index.core.prompts import PromptTemplate

# from api_interfaces import

# class Forecast(BaseModel):
#     claims: List[str]

# class Claim(BaseModel):
#     claim: str = Field(
#         description=(
#             "A precise claim capturing\n"
#             "- the context of the sentence, i.e. date of the report, company or market discussed\n"
#             "- the topic of the sentence, i.e. company KPI or market characteristic\n"
#             "- the expected value or trend using the correct units\n"
#             "- the period or horizon date"
#         )
#     )
#     source_text: str = Field(
#         description="The exact sentence from the document that supports the claim."
#     )
#     file_path: str = Field(
#         description="Filesystem path of the source document."
#     )
#     page_num: int = Field(
#         description="Page number in the document where the sentence appears."
#     )


# claims_template = PromptTemplate(
#     template=
#         """\
# What are *all* the sentences that express a projection, an outlook or an expectation about company KPIs or market characteristics?
# Make sure your response is compact JSON (no extra line breaks or comments).
# """,
#     output_parser=parser,      # this auto-injects parser.get_format_string()
# )


class Claim(BaseModel):
    text: str

class ClaimList(BaseModel):
    claims: List[Claim]

CLAIM_PARSER = PydanticOutputParser(output_cls=ClaimList)

class ClaimGetterPipeline:
    
    def __init__(
        self,
        config: dict,
    ):
        # llm that extracts claim from document
        self.llm = OpenAI(
            model= config["model_name"],
            temperature=config["temperature"],
            max_tokens=config["max_tokens"],
            # output_parser=CLAIM_PARSER,
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
    

    def build_qengine(
            self, 
            file_path: str
        ) -> BaseQueryEngine:

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

        query_engine = index.as_query_engine(
            llm=self.llm,
            multiple_calls=True,
            # verbose=True,
        )

        return query_engine



# # TODO pipeline
# class ClaimGetter:

#     def __init__(
#         self,
#         config: Dict,
#     ):
#         self.model_name = config["model_name"]
#         self.llm = OpenAI(
#             model=self.model_name,
#             temperature=config["temperature"],
#             max_tokens=config["max_tokens"],
#         )
#         self.parser = PydanticOutputParser(output_cls=Forecast)

#     # TODO replace this with file query engine
#     def build_query_engine(self, file_path: str):

#         docs = PDFReader().load_data(file=file_path)
#         index = VectorStoreIndex.from_documents(docs)
#         synthesizer = get_response_synthesizer(
#             llm=self.llm,
#             # response_mode="accumulate"
#         )

#         return index.as_query_engine(response_synthesizer=synthesizer)

#     # TODO move this outside getter
#     # TODO replace this with file retriever + sentence level filter
#     def build_sentence_retriever(self, file_path: str):

#         docs = PDFReader().load_data(file=file_path)
#         splitter = SentenceWindowNodeParser.from_defaults(
#             window_size=1,
#             window_metadata_key="window",
#             original_text_metadata_key="sentence",
#         )
#         index = VectorStoreIndex.from_documents(docs, transformations=[splitter])

#         return index.as_retriever(similarity_top_k=1)

#     # def extract_from_path(self, file_path: str) -> List[Claim]:

#     #     # 1. extract list of claims
#     #     query_engine = self.build_query_engine(file_path)
#     #     prompt = get_prompt("extract claims")
#     #     all_claims = query_engine.query(
#     #         prompt.format(output_format=self.parser.get_format_string())
#     #     )
#     #     parsed_claims = self.parser.parse(all_claims.response).claims
#     #     # 2. sentence‐level search to get bounding box of each claim
#     #     retriever = self.build_sentence_retriever(file_path)
#     #     claims: List[Claim] = []
#     #     for claim in parsed_claims:
#     #         sentence = retriever.retrieve(claim)[0]
#     #         source = " ".join(sentence.get_content().split())
#     #         page_num = int(sentence.node.metadata.get("page_label"))
#     #         bbox, doc = find_fuzzy_bounding_boxes(file_path, source, page_num) or []

#     #         claims.append(
#     #             Claim(
#     #                 text=claim,
#     #                 source=source,
#     #                 page_num=page_num,
#     #                 bounding_box=bbox,
#     #                 page_width=doc.rect.width,
#     #                 page_height=doc.rect.height,
#     #             )
#     #         )
#     #     return claims

#     # def extract(
#     #     self,
#     #     summary_query_engine: BaseQueryEngine,
#     #     mix_retriever: BaseRetriever,
#     #     file_path: str,
#     # ) -> List[Claim]:

#     #     # 1. extract list of claims
#     #     prompt = get_prompt("extract claims")

#     #     # summary_query_engine = doc_wrapper.doc_tool.query_engine._query_engines['summary_qengine']
#     #     all_claims = summary_query_engine.query(
#     #         prompt.format(output_format=self.parser.get_format_string())
#     #     )
#     #     parsed_claims = self.parser.parse(all_claims.response).claims

#     #     # TODO have several claims possibly link to same annotation

#     #     # 2. sentence‐level search to get bounding box of each claim
#     #     claims: List[Claim] = []
#     #     for claim in parsed_claims:
#     #         sentence = mix_retriever.retrieve(claim)[0]
#     #         source = " ".join(sentence.get_content().split())
#     #         page_num = int(sentence.node.metadata.get("page_label"))
#     #         bbox, doc = find_fuzzy_bounding_boxes(file_path, source, page_num)

#     #         claims.append(
#     #             Claim(
#     #                 text=claim,
#     #                 source=source,
#     #                 page_num=page_num,
#     #                 bounding_box=bbox,
#     #                 # Using first page's dimensions for now TODO: Set per page
#     #                 page_width=doc[0].rect.width,
#     #                 page_height=doc[0].rect.height,
#     #             )
#     #         )

#     #     return claims
