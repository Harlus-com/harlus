from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from src.util import snake_to_camel


class BaseCamelModel(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=snake_to_camel,
        from_attributes=True,
        frozen=True,
    )


class BoundingBox(BaseCamelModel):
    left: float
    top: float
    width: float
    height: float
    page: int


class HighlightArea(BaseCamelModel):
    bounding_boxes: list[BoundingBox] = Field(alias="boundingBoxes")
    jump_to_page_number: int = Field(alias="jumpToPageNumber")


class LinkComment(BaseCamelModel):
    id: str
    file_id: str = Field(alias="fileId")
    text: str
    highlight_area: HighlightArea = Field(alias="highlightArea")
    parent_comment_id: str = Field(alias="parentCommentId")


class ClaimComment(BaseCamelModel):
    id: str
    file_id: str = Field(alias="fileId")
    text: str
    highlight_area: HighlightArea = Field(alias="highlightArea")
    links: list[LinkComment]
    verdict: Literal["true", "false", "unknown"]


class ChatSourceComment(BaseCamelModel):
    id: str
    file_id: str = Field(alias="fileId")
    thread_id: str = Field(alias="threadId")
    message_id: str = Field(alias="messageId")
    text: str
    highlight_area: HighlightArea = Field(alias="highlightArea")
    next_chat_comment_id: str = Field(alias="nextChatCommentId")
