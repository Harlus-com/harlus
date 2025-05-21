from .custom_types import BoundingBox
from .custom_types import HighlightArea
import fitz
from llama_index.core.schema import NodeWithScore

# TODO: Write these cleaner according to the following schema:
# class Dummy(BaseModel):
#     pass
# 
#     @classmethod
#     def from_node(cls, node: NodeWithScore) -> Self:
#         pass


def _get_page_from_node(
    node: NodeWithScore,
    ):
    doc_items = node.metadata.get("doc_items", [])
    doc_item = doc_items[0]
    positions = doc_item.get("prov", [])
    position = positions[0]
    page_nb = position.get("page_no", 0)
    return page_nb-1


def _get_file_path_from_node(
    node: NodeWithScore,
    ) -> str:
    return node.metadata.get("file_path", "")


def _get_bounding_box_from_rect(rect: fitz.Rect, 
                                file_path: str, 
                                page_nb: int
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

def _get_bounding_boxes_from_node(
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