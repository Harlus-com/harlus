from .custom_types import(
    ChatSourceComment,
    HighlightArea,
    DocSearchRetrievedNode
)
import uuid
from llama_index.core.schema import NodeWithScore

def get_chat_source_comments_from_retrieved_nodes(retrieved_nodes: list[DocSearchRetrievedNode], thread_id: str, message_id: str) -> list[ChatSourceComment]:
    chat_source_comments = []
    for retrieved_node in retrieved_nodes:
        highlight_area = HighlightArea(
            bounding_boxes=retrieved_node.metadata.bounding_boxes,
            jump_to_page_number=retrieved_node.metadata.page_nb
        )
        chat_source_comment = ChatSourceComment(
            id=str(uuid.uuid4()),
            highlight_area=highlight_area,
            file_path=retrieved_node.metadata.file_path,
            text="Source used in chat",
            next_chat_comment_id=str(uuid.uuid4()), # currently not used
            thread_id=thread_id,
            message_id=message_id,
        )
        chat_source_comments.append(chat_source_comment)
    return chat_source_comments
        

def get_chat_source_comments_from_citations(citations: list[str], retrieved_nodes: list[NodeWithScore]) -> list[ChatSourceComment]:
    pass