from pydantic import BaseModel
from typing import (
    List, 
    Optional, 
    Literal, 
)
class BoundingBox(BaseModel):
    left: float # percentage of page width
    top: float # percentage of page height
    width: float # percentage of page width
    height: float # percentage of page height
    page: int # 1-based indexing

class HighlightArea(BaseModel):
    bounding_boxes: List[BoundingBox]
    jump_to_page_number: int

class Claim(BaseModel):
    text: str # claim
    file_path: str
    highlight_area: HighlightArea

class LinkComment(BaseModel):
    file_path: str
    highlight_area: HighlightArea
    text: Optional[str] = None # text in link comment, empty for now

class ClaimComment(BaseModel):
    file_path: str
    text: str # text in comment
    highlight_area: HighlightArea
    links: List[LinkComment]
    verdict: Literal["true", "false", "unknown"]



