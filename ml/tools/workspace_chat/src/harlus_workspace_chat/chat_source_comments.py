from .type_utils import(
    get_bounding_boxes_from_node,
    get_file_path_from_node,
    get_page_from_node
)
from .custom_types import(
    ChatSourceComment,
    BoundingBox,
    HighlightArea
)
import uuid

def get_chat_source_comments_from_retrieved_nodes(retrieved_nodes: list[RetrievedNode], thread_id: str, message_id: str) -> list[ChatSourceComment]:
    chat_source_comments = []
    for retrieved_node in retrieved_nodes:
        file_path = get_file_path_from_node(retrieved_node)
        page_nb = get_page_from_node(retrieved_node)
        bounding_boxes = get_bounding_boxes_from_node(retrieved_node, page_nb, file_path)
        highlight_area = HighlightArea(
            bounding_boxes=bounding_boxes,
            jump_to_page_number=page_nb
        )
        chat_source_comment = ChatSourceComment(
            id=str(uuid.uuid4()),
            highlight_area=highlight_area,
            file_path=file_path,
            text="Source used in chat",
            next_chat_comment_id=None,
            thread_id=thread_id,
            message_id=message_id,
        )
        chat_source_comments.append(chat_source_comment)
    return chat_source_comments
        

def get_chat_source_comments_from_citations(citations: list[str], retrieved_nodes: list[RetrievedNode]) -> list[ChatSourceComment]:
    pass