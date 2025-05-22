from llama_index.core.schema import NodeWithScore
from .custom_types import (
    DocSearchRetrievedNode,
    DocSearchNodeMetadata,
    TavilyToolRetrievedWebsite,
)
import fitz
from .custom_types import BoundingBox


# TODO: Write these cleaner according to the following schema:
# class Dummy(BaseModel):
#     pass
#
#     @classmethod
#     def from_node(cls, node: NodeWithScore) -> Self:
#         pass

def get_bounding_boxes_from_node(
        node: NodeWithScore, 
        page_nb: int, 
        file_path: str
        ) -> list[BoundingBox]:
    doc = fitz.open(file_path)
    page_width = doc[page_nb].rect.width
    page_height = doc[page_nb].rect.height
    bounding_boxes = []
    doc_items = node.metadata.get("doc_items", [])
    for doc_item in doc_items:
        positions = doc_item.get("prov", [])
        for position in positions:
            page_nb = position.get("page_no", 0)
            bbox_in = position.get("bbox", None)
            if bbox_in is not None:
                bbox_out = BoundingBox(
                    left=bbox_in["l"] / page_width * 100,
                    top=(page_height - bbox_in["t"]) / page_height * 100,
                    width=(bbox_in["r"] - bbox_in["l"]) / page_width * 100,
                    height=(bbox_in["t"] - bbox_in["b"]) / page_height * 100,
                    page=page_nb-1,
                )
                bounding_boxes.append(bbox_out)
    return bounding_boxes

# TODO: Change after rebase - copy from source_highlight
def get_file_id_from_node(
    node: NodeWithScore,
    ) -> str:
    return node.metadata.get("file_id", "")


def get_page_from_node(
    node: NodeWithScore,
    ):
    doc_items = node.metadata.get("doc_items", [])
    doc_item = doc_items[0]
    positions = doc_item.get("prov", [])
    position = positions[0]
    page_nb = position.get("page_no", 0)
    return page_nb-1



def get_doc_search_retrieved_node_from_node_with_score(retrieved_node: NodeWithScore, file_id_to_path: dict[str, str]) -> DocSearchRetrievedNode:

    page_nb = get_page_from_node(retrieved_node)
    file_id = get_file_id_from_node(retrieved_node)
    bounding_boxes = get_bounding_boxes_from_node(retrieved_node, page_nb, file_id_to_path[file_id])

    metadata = DocSearchNodeMetadata(
        raw_metadata=retrieved_node.metadata,
        page_nb=page_nb,
        file_id=file_id,
        bounding_boxes=bounding_boxes
    )
    output = DocSearchRetrievedNode(
        metadata=metadata,
        text=retrieved_node.text,
    )
    return output



def get_nodes_with_score_from_doc_search_tool_result(tool_result: any, tool_type: str) -> list[NodeWithScore]:
    if "retriever" in tool_type:
        raw_source_nodes = tool_result.raw_output
    else:
        raw_source_nodes = tool_result.raw_output.source_nodes
    return raw_source_nodes


def get_tavily_tool_retrieved_website_from_tool_result(tool_result: any) -> TavilyToolRetrievedWebsite:
    tavily_tool_retrieved_website = TavilyToolRetrievedWebsite(
        title=tool_result.get("title", ""),
        url=tool_result.get("url", ""),
        content=tool_result.get("content", ""),
    )
    return tavily_tool_retrieved_website
