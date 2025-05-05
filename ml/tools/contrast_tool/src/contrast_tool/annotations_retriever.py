
# TODO implement retriever that automatically yields relevant sentences and bounding boxes
# this would replace sentence retrievers in ClaimGetter and ClaimChecker
# this wouls also allow extracting several sentences

# class Annotation:
    
#     def __init__(
#         self,
#         config: dict,
#     ):
#         # llm that extracts claim from document
#         self.llm = OpenAI(
#             model= config["model_name"],
#             temperature=config["temperature"],
#             max_tokens=config["max_tokens"],
#             # output_parser=CLAIM_PARSER,
#         )


#     def build_sentence_retriever(self, file_path: str):

#         docs = PDFReader().load_data(file=file_path)
#         splitter = SentenceWindowNodeParser.from_defaults(
#             window_size=1,
#             window_metadata_key="window",
#             original_text_metadata_key="sentence",
#         )
#         index = VectorStoreIndex.from_documents(docs, transformations=[splitter])

#         return index.as_retriever(similarity_top_k=1)