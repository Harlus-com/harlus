import os, json

from llama_index.core.tools import QueryEngineTool

from .claim_getter import ClaimGetter
from .claim_checker import ClaimChecker

# from .utils import add_router

from .utils import load_config

DEFAULT_CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config.yaml")

class ContrastTool:
    def __init__(self):

        config = load_config(DEFAULT_CONFIG_PATH)

        self.getter = ClaimGetter(config["claim getter"], )
        self.checker = ClaimChecker(config["claim checker"])

        # set up API endpoint
        # self.router = add_router(config["contrast tool"]["api"], handler=self.compare_documents)
        

    def extract_claims(self, doc_wrapper: QueryEngineTool):
        """
        Extracts claims from the provided document using ClaimGetter.

        :param file_path: Path to the old document.
        :return: List of extracted claim texts.
        """
        claims = self.getter.extract(doc_wrapper)
        return [claim.text for claim in claims]


    def compare_documents_from_path(self, old_file: str, new_file: str):
        print(f"\nExtracting claims from old document: {old_file}")
        claims = self.getter.extract_from_path(old_file)
        claims_text = [claim.text for claim in claims]
        for claim in claims_text:
            print(f"Claim: {claim}")

        print(f"\nAnalyzing claims against new document: {new_file}")
        verdict = self.checker.analyse_from_path(claims_text, new_file)

        print("\nVerdict:")
        print(json.dumps(verdict, indent=2))

        output = {}
        for claim in claims:
            output[claim.text] = {
                "page_num": claim.page_num,
                "bbox": claim.bounding_box,
                "verdict": verdict[claim.text]["verdict"],
                "explanation": verdict[claim.text]["explanation"]
            }

        return output
    

    def compare_documents(self, old_doc: QueryEngineTool, new_doc: QueryEngineTool):
        print(f"\nExtracting claims from old document: {old_doc.get_tool_name()}")
        claims = self.extract_claims(old_doc)
        for claim in claims:
            print(f"Claim: {claim}")

        print(f"\nAnalyzing claims against new document: {new_doc.get_tool_name()}")
        verdict = self.checker.analyse(claims, new_doc)

        print("\nVerdict:")
        print(json.dumps(verdict, indent=4))

        return verdict
