
from pydantic import BaseModel
from typing import Annotated, TypedDict
from langgraph.graph.message import add_messages


class ToolRetrievedNode(BaseModel):
    metadata: dict
    text: str


class GraphState(TypedDict):
    messages: Annotated[list, add_messages]
    retrieved_nodes: list[list[any]]
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
    file_id: str
    thread_id: str
    message_id: str
    text: str
    highlight_area: HighlightArea
    next_chat_comment_id: str