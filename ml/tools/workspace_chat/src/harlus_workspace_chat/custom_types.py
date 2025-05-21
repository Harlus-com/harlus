
from pydantic import BaseModel
from typing import Annotated, TypedDict, Union
from langgraph.graph.message import add_messages


class BoundingBox(BaseModel):
    left: float
    top: float
    width: float
    height: float
    page: int
    type: str 

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

class ChatGraphState(TypedDict):
    messages: Annotated[list, add_messages]
    sources: list[Union[DocSearchRetrievedNode, TavilyToolRetrievedWebsite]]
    full_answer: str


class BoundingBox(BaseModel):
    left: float
    top: float
    width: float
    height: float
    page: int

class HighlightArea(BaseModel):
    bounding_boxes: list[BoundingBox]
    jump_to_page_number: int

class ChatSourceComment(BaseModel):
    id: str
    file_path: str
    thread_id: str
    message_id: str
    text: str
    highlight_area: HighlightArea
    next_chat_comment_id: str