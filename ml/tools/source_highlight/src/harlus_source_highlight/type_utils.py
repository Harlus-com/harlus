from .custom_types import (
    BoundingBox,
    DocSearchNodeMetadata,
    DocSearchRetrievedNode,
)
import fitz
from llama_index.core.schema import NodeWithScore


# TODO: Write these cleaner according to the following schema:
# class Dummy(BaseModel):
#     pass
#
#     @classmethod
#     def from_node(cls, node: NodeWithScore) -> Self:
#         pass

# TODO: We have some double classes here. Ideally we split the functions 
# instead of doing fake overloading.


def get_page_from_node(
    node: NodeWithScore | DocSearchRetrievedNode,
):
    if isinstance(node, NodeWithScore):
        doc_items = node.metadata.get("doc_items", [])
        doc_item = doc_items[0]
        positions = doc_item.get("prov", [])
        position = positions[0]
        page_nb = position.get("page_no", 0)
        return page_nb - 1
    else:
        return node.metadata.page_nb


def get_file_id_from_node(
    node: NodeWithScore | DocSearchRetrievedNode,
) -> str:
    if isinstance(node, NodeWithScore):
        return node.metadata.get("file_id", "")
    else:
        return node.metadata.file_id


def get_bounding_box_from_rect(
    rect: fitz.Rect, file_path: str, page_nb: int
) -> BoundingBox:
    doc = fitz.open(file_path)
    page_width = doc[page_nb].rect.width
    page_height = doc[page_nb].rect.height
    bbox = BoundingBox(
        left=rect.x0 / page_width * 100,
        top=rect.y0 / page_height * 100,
        width=(rect.x1 - rect.x0) / page_width * 100,
        height=(rect.y1 - rect.y0) / page_height * 100,
        page=page_nb,
    )
    return bbox


def get_bounding_boxes_from_node(
    node: NodeWithScore | DocSearchRetrievedNode, page_nb: int, file_path: str
) -> list[BoundingBox]:
    if isinstance(node, NodeWithScore):
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
                        page=page_nb - 1,
                    )
                    bounding_boxes.append(bbox_out)
        return bounding_boxes
    else:
        return node.metadata.bounding_boxes


def get_doc_search_retrieved_node_from_node_with_score(retrieved_node: NodeWithScore, file_id_to_path: dict[str, str]) -> DocSearchRetrievedNode:

    page_nb = get_page_from_node(retrieved_node)
    file_id = get_file_id_from_node(retrieved_node)
    bounding_boxes = get_bounding_boxes_from_node(retrieved_node, page_nb, file_id_to_path[file_id])

    metadata = DocSearchNodeMetadata(
        raw_metadata=retrieved_node.metadata,
        page_nb=page_nb,
        file_id=file_id,
        bounding_boxes=[BoundingBox(**bbox.model_dump()) for bbox in bounding_boxes]
    )
    output = DocSearchRetrievedNode(
        metadata=metadata,
        text=retrieved_node.text,
    )
    return output

