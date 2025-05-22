from .llm_utils import get_best_retrieved_nodes, get_source_from_nodes_with_llm
from .pdf_utils import _get_bag_of_words_rects, _get_fuzzy_match_rects
from .type_utils import (
    get_bounding_box_from_rect,
    get_bounding_boxes_from_node,
    get_file_id_from_node,
    get_page_from_node,
    get_doc_search_retrieved_node_from_node_with_score,
)
from .custom_types import (
    HighlightArea,
    DocSearchRetrievedNode,
)
from langchain_core.tools import Tool
from llama_index.core.schema import NodeWithScore


class HighlightPipeline:
    def __init__(
        self,
        file_id_to_path: dict[str, str],
        retrievers: list[Tool] = [],
        nodes: list[NodeWithScore] | list[DocSearchRetrievedNode] = [],
        verbose_level: int = 2,
    ):
        if len(retrievers) == 0 and len(nodes) == 0:
            raise ValueError("Either retrievers or nodes must be provided")

        self.file_id_to_path = file_id_to_path
        self.retrievers = retrievers
        self.nodes = nodes
        if len(self.nodes) > 0 and isinstance(self.nodes[0], NodeWithScore):
            self.nodes = [
                get_doc_search_retrieved_node_from_node_with_score(node, file_id_to_path)
                for node in self.nodes
            ]
        
        self.verbose_level = verbose_level
        self.verbose_text = ""
    
    def _log_collect(self, text: str, level: int = 1):
        if self.verbose_level >= level:
            self.verbose_text += text
    
    def _log_flush(self):
        print(self.verbose_text)
        self.verbose_text = ""

    async def run(
        self,
        source_text: str,
    ) -> tuple[HighlightArea | None, str | None, str | None]:

        # Due to async, we rather collect all print statements in a single string
        # and print it once at the end.
        self._log_collect(" ==== NodePipeline DEBUG set-up ==== \n", level=2)

        # Determine entry point in pipeline. If nodes are provided,
        # these are used. Otherwise we start with a retrieval step to get the
        # most relevant nodes.
        start_with_nodes = False
        if self.nodes is not None and len(self.nodes) > 0:
            start_with_nodes = True
        else:
            assert (
                len(self.retrievers) > 0
            ), "Either retrievers or nodes must be provided"

        self._log_collect(f" - start with nodes: {start_with_nodes}\n", level=2)

        # Split source text into sentences to increase robustness
        # for large source texts at the cost of potentially double-matching small
        # sentences.
        source_text_splits = source_text.split(". ")
        all_wrapped_bounding_boxes = []

        for source_text_split in source_text_splits:

            state = ""
            skip_to_bag_of_words = False
            can_use_node_bboxes = False
            bounding_boxes = []
            file_id = ""
            page_nb = 0

            self._log_collect(f" \n\n==== NodePipeline DEBUG : source text split iteration ==== \n", level=2)
            self._log_collect(f" - source_text_split: {source_text_split}\n", level=2)

            # Retrieve nodes
            if not start_with_nodes:
                self._log_collect(f" <retriever step>\n", level=2)
                best_retrieved_nodes = await get_best_retrieved_nodes(
                    source_text,  # use full source text for better performance
                    self.retrievers,
                    min_score=8,
                )
                # convert to DocSearchRetrievedNode
                best_retrieved_nodes = [
                    get_doc_search_retrieved_node_from_node_with_score(node, self.file_id_to_path)
                    for node in best_retrieved_nodes
                ]
                if best_retrieved_nodes is None:
                    state = "failed to retrieve nodes"
                    skip_to_bag_of_words = True
                    self._log_collect(f" - retriever step failed\n", level=2)
                else:
                    page_nb = get_page_from_node(best_retrieved_nodes[0])
                    file_id = get_file_id_from_node(best_retrieved_nodes[0])
                    self._log_collect(f" - best retrieved nodes:\n", level=2)
                    for node in best_retrieved_nodes:
                        self._log_collect(f"     - {node.text}\n", level=2)
            else:
                best_retrieved_nodes = self.nodes

            # Extract source text from nodes with LLM
            if not skip_to_bag_of_words:
                self._log_collect(f" <source text extraction step>\n", level=2)
                matched_text, matching_node = await get_source_from_nodes_with_llm(
                    best_retrieved_nodes, source_text_split
                )
                if matched_text is None or matching_node is None:
                    state = "failed to retrieve source text"
                    self._log_collect(f" - source text extraction step failed\n", level=2)
                    skip_to_bag_of_words = True
                else:
                    can_use_node_bboxes = True
                    self._log_collect(f" - matched text: {matched_text}\n", level=2)
                    self._log_collect(f" - matching node: {matching_node.text}\n", level=2)

            # Search the pdf for the exact source text
            if not skip_to_bag_of_words:
                self._log_collect(f" <fuzzy match step>\n", level=2)
                file_id = get_file_id_from_node(matching_node)
                page_nb = get_page_from_node(matching_node)
                rects, pdf_matched_text = _get_fuzzy_match_rects(
                    matched_text, self.file_id_to_path[file_id], page_nb
                )
                if rects is None:
                    state = "failed to retrieve rects with fuzzy match"
                    self._log_collect(f" - fuzzy match step failed\n", level=2)
                    skip_to_bag_of_words = True
                else:
                    state = "retrieved rects with fuzzy match"
                    bounding_boxes = [
                        get_bounding_box_from_rect(
                            rect, self.file_id_to_path[file_id], page_nb
                        )
                        for rect in rects
                    ]
                    self._log_collect(f" - fuzzy match succeeded\n", level=2)
                    self._log_collect(f" - pdf matched text: {pdf_matched_text}\n", level=2)

            # Fall back to bag of words
            if skip_to_bag_of_words:
                self._log_collect(f" <bag of words step>\n", level=2)
                rects = _get_bag_of_words_rects(
                    source_text_split, self.file_id_to_path[file_id], page_nb
                )
                if rects is None:
                    state = "failed to retrieve rects with bag of words"
                    self._log_collect(f" - bag of words step failed\n", level=2)
                else:
                    state = "retrieved rects with bag of words"
                    bounding_boxes = [
                        get_bounding_box_from_rect(
                            rect, self.file_id_to_path[file_id], page_nb
                        )
                        for rect in rects
                    ]
                    self._log_collect(f" - bag of words succeeded\n", level=2)

            # Fall back to node bounding boxes (if possible)
            if can_use_node_bboxes and len(bounding_boxes) == 0:
                self._log_collect(f" <node bounding boxes step>\n", level=2)
                bounding_boxes = get_bounding_boxes_from_node(
                    matching_node, page_nb, self.file_id_to_path[file_id]
                )
                state = "retrieved bounding boxes from node"

            # Wrap the bounding boxes
            if len(bounding_boxes) > 0:

                # remove any bounding boxes that are too thin
                bounding_boxes = [bb for bb in bounding_boxes if bb.width > 1]

                wrapped_bounding_boxes = {
                    "bounding_boxes": bounding_boxes,
                    "jump_to_page_number": page_nb,
                    "file_id": file_id,
                    "source_text": source_text_split,
                    "state": state,
                }
                if (
                    len(all_wrapped_bounding_boxes) > 0
                    and "file_id" in wrapped_bounding_boxes
                    and "file_id" in all_wrapped_bounding_boxes[0]
                ):
                    if (
                        wrapped_bounding_boxes["file_id"]
                        == all_wrapped_bounding_boxes[0]["file_id"]
                    ):
                        all_wrapped_bounding_boxes.append(wrapped_bounding_boxes)
                    else:
                        self._log_collect(f"Warning: Mismatched file paths detected. Expected {all_wrapped_bounding_boxes[0]['file_id']}, got {wrapped_bounding_boxes['file_id']}\n", level=2)
                else:
                    all_wrapped_bounding_boxes.append(wrapped_bounding_boxes)

        self._log_flush()

        # Post-process the wrapped bounding boxes to highlight areas
        # In the future we could skip the wrapped_bounding_boxes intermediate type
        # and directly work with the bounding boxes.
        # wrapped_bounding_boxes are mostly useful for debugging.
        bounding_boxes = []
        for wbb in all_wrapped_bounding_boxes:
            bounding_boxes.extend(wbb["bounding_boxes"])
        if len(bounding_boxes) > 0:
            page_number = all_wrapped_bounding_boxes[0]["jump_to_page_number"]
            file_id = all_wrapped_bounding_boxes[0]["file_id"]
            state = all_wrapped_bounding_boxes[0]["state"]
            highlight_area = HighlightArea(
                bounding_boxes=bounding_boxes,
                jump_to_page_number=page_number,
            )
            return highlight_area, file_id, state
        else:
            return None, None, "failed to retrieve highlight area"
