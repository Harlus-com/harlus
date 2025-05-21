from llama_index.core.schema import NodeWithScore
from .custom_types import (
    DocSearchRetrievedNode, 
    DocSearchNodeMetadata, 
    TavilyToolRetrievedWebsite
)


# TODO: Write these cleaner according to the following schema:
# class Dummy(BaseModel):
#     pass
# 
#     @classmethod
#     def from_node(cls, node: NodeWithScore) -> Self:
#         pass

def _get_doc_search_retrieved_node_from_node_with_score(retrieved_node: NodeWithScore) -> DocSearchRetrievedNode:

    assert isinstance(retrieved_node, NodeWithScore), "[Harlus_chat] Retreived node is not a NodeWithScore"
    page_nb = 0 
    bounding_boxes = []
    doc_items = retrieved_node.metadata.get("doc_items", [])
    for doc_item in doc_items:
        positions = doc_item.get("prov", [])
        for position in positions:
            page_nb = position.get("page_no", 0)
            bbox = position.get("bbox", None)
            if bbox is not None:
                bounding_boxes.append({
                    "left": bbox['l'],
                    "top": bbox['t'],
                    "width": bbox['r'] - bbox['l'],
                    "height": bbox['t'] - bbox['b'],
                "page": page_nb,
                "type": "absolute"
            })
    metadata = DocSearchNodeMetadata(
        raw_metadata=retrieved_node.metadata,
        page_nb=page_nb,
        file_path=retrieved_node.metadata.get("file_path", ""),
        bounding_boxes=bounding_boxes
    )
    output = DocSearchRetrievedNode(
        metadata=metadata,
        text=retrieved_node.text,
    )
    return output


def _get_nodes_with_score_from_doc_search_tool_result(tool_result: any, tool_type: str) -> list[NodeWithScore]:
    if "retriever" in tool_type:
        raw_source_nodes = tool_result.raw_output
    else:
        raw_source_nodes = tool_result.raw_output.source_nodes
    return raw_source_nodes


def _get_tavily_tool_retrieved_website_from_tool_result(tool_result: any) -> TavilyToolRetrievedWebsite:
    tavily_tool_retrieved_website = TavilyToolRetrievedWebsite(
        title=tool_result.get("title", ""),
        url=tool_result.get("url", ""),
        content=tool_result.get("content", ""),
    )
    return tavily_tool_retrieved_website