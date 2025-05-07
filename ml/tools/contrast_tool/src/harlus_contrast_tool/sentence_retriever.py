from llama_index.llms.openai import OpenAI
from llama_index.core.node_parser import SentenceWindowNodeParser

from llama_index.readers.file import PDFReader

from llama_index.core import VectorStoreIndex

# TODO implement retriever that automatically yields relevant sentences and bounding boxes
# this would replace sentence retrievers in ClaimGetter and ClaimChecker
# this wouls also allow extracting several sentences

class SentenceRetrieverPipeline:
    
    @staticmethod
    def build(file_path: str):
        # TODO spice up the pipeline for better retrieval
        #   - sentences over several pages
        #   - add HighlightArea as metadata
        #   - parse tables correctly so that can highlight tables
        #   - add choice for llm
        #   - add choice for embeddings

        docs = PDFReader().load_data(file=file_path)
        splitter = SentenceWindowNodeParser.from_defaults(
            window_size=1,
            window_metadata_key="window",
            original_text_metadata_key="sentence",
        )
        index = VectorStoreIndex.from_documents(docs, transformations=[splitter])

        return index.as_retriever(similarity_top_k=1)