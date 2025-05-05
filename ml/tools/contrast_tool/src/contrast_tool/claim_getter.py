from pydantic import BaseModel, Field
from typing import List, Tuple

from llama_index.llms.openai import OpenAI
from llama_index.core.output_parsers import PydanticOutputParser
from llama_index.core import VectorStoreIndex

from llama_index.core.tools import QueryEngineTool
from llama_index.core.base.base_query_engine import BaseQueryEngine

from llama_index.readers.file import PDFReader

from llama_index.core import get_response_synthesizer

from .utils import *

from llama_index.core.prompts import PromptTemplate


class Claim(BaseModel):
    text: str

class ClaimList(BaseModel):
    claims: List[Claim]

CLAIM_PARSER = PydanticOutputParser(output_cls=ClaimList)

PROMPT_GET_CLAIMS_TEXT = f"""\
Considering the date of the report, what are *all* the sentences in this report that express a projection, an outlook or an expectation about company KPIs or market characteristics? \
Write one precise sentence per item, each time mentioning the topic, the expected value or trend and the period or horizon date. \
Rely on the date of the report to make precise time-related claims. Instead of writing "this year" or "next quarter", specify the year or the quarter. \
Use *only* figures that appear in the text. Do not invent anything.
{CLAIM_PARSER.get_format_string()}
"""


# TODO make subclass of QueryEngine
class ClaimQueryEnginePipeline:
    
    @staticmethod
    def build(
            file_path: str,
            model_config: dict
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
                doc.metadata["page_num"] = i + 1 # start counting from 1

        index = VectorStoreIndex.from_documents(documents)

        # llm that extracts claim from document
        llm = OpenAI(
            model= model_config["model_name"],
            temperature=model_config["temperature"],
            max_tokens=model_config["max_tokens"],
        )

        return index.as_query_engine(
            llm=llm,
            multiple_calls=True,
            # verbose=True,
        )