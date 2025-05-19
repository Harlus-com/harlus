from pydantic import BaseModel
from typing import (
    List, 
    Optional, 
    Literal, 
    Annotated, 
    TypedDict
)
from langgraph.graph.message import add_messages


class BoundingBox(BaseModel):
    left: float # percentage of page width
    top: float # percentage of page height
    width: float # percentage of page width
    height: float # percentage of page height
    page: int # 1-based indexing

class DocSearchNodeMetadata(BaseModel):
    raw_metadata: dict
    page_nb: int
    file_path: str
    bounding_boxes: list[BoundingBox]

class DocSearchToolMetadata(BaseModel):
    date: str
    ticker: str
    keywords: str
    source_name: str
    title: str
    company_name: str
    summary: str
    file_path: str

class DocSearchRetrievedNode(BaseModel):
    metadata: DocSearchNodeMetadata
    text: str

class TavilyToolRetrievedWebsite(BaseModel):
    title: str
    url: str
    content: str


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

class ContrastToolGraphState(TypedDict):
    internal_messages: Annotated[list, add_messages]
    internal_retrieved_nodes: list[DocSearchRetrievedNode]
    external_messages: Annotated[list, add_messages]
    external_retrieved_nodes: list[DocSearchRetrievedNode]
    driver_tree: str
    claim_comments: list[ClaimComment]





