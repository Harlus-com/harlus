from .llm_utils import (
    _get_best_retrieved_nodes, 
    _get_source_from_nodes_with_llm
)
from .pdf_utils import (
    _get_bag_of_words_rects, 
    _get_fuzzy_match_rects
)
from .type_utils import (
    _get_bounding_box_from_rect, 
    _get_bounding_boxes_from_node, 
    _get_page_from_node, 
    _get_file_path_from_node
)
from .custom_types import HighlightArea
from langchain_core.tools import Tool
from llama_index.core.schema import NodeWithScore


class HighlightPipeline:
    def __init__(self, 
                 retrievers: list[Tool] = None, 
                 nodes: list[NodeWithScore] = None,
                 verbose: int = 0
                 ):
    
        if retrievers is None and nodes is None:
            raise ValueError("Either retrievers or nodes must be provided")
        
        self.retrievers = retrievers
        self.nodes = nodes
        self.verbose = verbose
    
    async def run(
            self,
            source_text: str, 
            ) -> tuple[HighlightArea | None, str | None, str | None]:
        
        # Determine entry point in pipeline. If nodes are provided, 
        # these are used. Otherwise we start with a retrieval step to get the
        # most relevant nodes.
        start_with_nodes = False
        if self.nodes is not None and len(self.nodes) > 0:
            start_with_nodes = True
        else:
            assert len(self.retrievers) > 0, "Either retrievers or nodes must be provided"
        
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
            file_path = ""
            page_nb = 0

            # Retrieve nodes
            if not start_with_nodes:
                best_retrieved_nodes = await _get_best_retrieved_nodes(
                    source_text, # use full source text for better performance
                    self.retrievers,
                    min_score=8
                )
                if best_retrieved_nodes is None:
                    state = "failed to retrieve nodes"
                    skip_to_bag_of_words = True
                    if self.verbose > 0:
                        print(f"Warning: Failed to retrieve nodes for source text: {source_text_split}")
                else:
                    page_nb = _get_page_from_node(best_retrieved_nodes[0])
                    file_path = _get_file_path_from_node(best_retrieved_nodes[0])

                    if self.verbose > 1:
                        print(" ==== DEBUG : retrieved nodes ==== ")
                        for node in best_retrieved_nodes:
                            print(node.text)
                        print(" ==== ======================= ==== ")
            else:
                best_retrieved_nodes = self.nodes
            
            # Extract source text from nodes with LLM
            if not skip_to_bag_of_words:
                matched_text, matching_node = await _get_source_from_nodes_with_llm(
                    best_retrieved_nodes,
                    source_text_split
                )
                if matched_text is None or matching_node is None:
                    state = "failed to retrieve source text"
                    if self.verbose > 0:
                        print(f"Warning: Failed to retrieve source text for source text: {source_text_split}")
                    skip_to_bag_of_words = True
                else:
                    can_use_node_bboxes = True
                    
                    if self.verbose > 1:
                        print(" ==== DEBUG : matched text ==== ")
                        print(matched_text)
                        print(" ==== ==================== ==== ")


            # Search the pdf for the exact source text
            if not skip_to_bag_of_words:
                file_path = _get_file_path_from_node(matching_node)
                page_nb = _get_page_from_node(matching_node)
                rects = _get_fuzzy_match_rects(
                    matched_text,
                    file_path,
                    page_nb
                )
                if rects is None:
                    state = "failed to retrieve rects with fuzzy match"
                    if self.verbose > 0:
                        print(f"Warning: Failed to retrieve rects with fuzzy match: {source_text_split}")
                    skip_to_bag_of_words = True
                else:
                    state = "retrieved rects with fuzzy match"
                    bounding_boxes = [_get_bounding_box_from_rect(rect, file_path, page_nb) for rect in rects]
            
            # Fall back to bag of words
            if skip_to_bag_of_words:
                rects = _get_bag_of_words_rects(
                    source_text_split,
                    file_path,
                    page_nb
                )
                if rects is None:
                    state = "failed to retrieve rects with bag of words"
                    if self.verbose > 0:
                        print(f"Warning: Failed to retrieve rects with bag of words: {source_text_split}")
                else:
                    state = "retrieved rects with bag of words"
                    bounding_boxes = [_get_bounding_box_from_rect(rect, file_path, page_nb) for rect in rects]
            
            # Fall back to node bounding boxes (if possible)
            if can_use_node_bboxes and len(bounding_boxes) == 0:
                bounding_boxes = _get_bounding_boxes_from_node(
                    matching_node,
                    page_nb,
                    file_path
                )
                state = "retrieved bounding boxes from node"

            # Wrap the bounding boxes
            if len(bounding_boxes) > 0:
                wrapped_bounding_boxes = {
                    "bounding_boxes": bounding_boxes,
                    "jump_to_page_number": page_nb,
                    "file_path": file_path,
                    "source_text": source_text_split,
                    "state": state
                }
                if len(all_wrapped_bounding_boxes) > 0 and 'file_path' in wrapped_bounding_boxes and 'file_path' in all_wrapped_bounding_boxes[0]:
                    if wrapped_bounding_boxes['file_path'] == all_wrapped_bounding_boxes[0]['file_path']:
                        all_wrapped_bounding_boxes.append(wrapped_bounding_boxes)
                    else:
                        if self.verbose > 0:
                            print(f"Warning: Mismatched file paths detected. Expected {all_wrapped_bounding_boxes[0]['file_path']}, got {wrapped_bounding_boxes['file_path']}")
                else:
                    all_wrapped_bounding_boxes.append(wrapped_bounding_boxes)
        
        # Post-process the wrapped bounding boxes to highlight areas
        # In the future we could skip the wrapped_bounding_boxes intermediate type
        # and directly work with the bounding boxes.
        # wrapped_bounding_boxes are mostly useful for debugging.
        bounding_boxes = []
        for wbb in all_wrapped_bounding_boxes:
            bounding_boxes.extend(wbb['bounding_boxes'])
        if len(bounding_boxes) > 0:
            page_number = all_wrapped_bounding_boxes[0]['jump_to_page_number']
            file_path = all_wrapped_bounding_boxes[0]['file_path']
            state = all_wrapped_bounding_boxes[0]['state']
            highlight_area = HighlightArea(
                bounding_boxes=bounding_boxes,
                jump_to_page_number=page_number,
            )
            return highlight_area, file_path, state
        else:
            return None, None, "failed to retrieve highlight area"
