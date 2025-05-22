from .custom_types import(
    ChatSourceComment,
    HighlightArea,
    DocSearchRetrievedNode
)
import uuid
from llama_index.core.schema import NodeWithScore
from typing import List, Tuple
from harlus_source_highlight import HighlightPipeline

def get_chat_source_comments_from_retrieved_nodes(
        retrieved_nodes: list[DocSearchRetrievedNode], 
        thread_id: str, 
        message_id: str,
        ) -> list[ChatSourceComment]:
    chat_source_comments = []
    for retrieved_node in retrieved_nodes:
        highlight_area = HighlightArea(
            bounding_boxes=retrieved_node.metadata.bounding_boxes,
            jump_to_page_number=retrieved_node.metadata.page_nb
        )
        chat_source_comment = ChatSourceComment(
            id=str(uuid.uuid4()),
            highlight_area=highlight_area,
            file_id=retrieved_node.metadata.file_id,
            text="Source used in chat",
            next_chat_comment_id=str(uuid.uuid4()), # currently not used
            thread_id=thread_id,
            message_id=message_id,
        )
        chat_source_comments.append(chat_source_comment)
    return chat_source_comments
        

async def get_chat_source_comments_from_citations(
        citations: List[Tuple[int, str]], 
        retrieved_nodes: list[NodeWithScore],
        file_id_to_path: dict[str, str],
        thread_id: str,
        message_id: str
        ) -> list[ChatSourceComment]:
    
    chat_source_comments = []
    highlight_pipeline = HighlightPipeline(
            nodes=retrieved_nodes,
            file_id_to_path=file_id_to_path,
        )
    for citation in citations:
        citation_nb = citation[0]
        citation_text = citation[1]
        highlight_area, file_id, state = await highlight_pipeline.run(citation_text)
        chat_source_comment = ChatSourceComment(
            id=str(uuid.uuid4()),
            highlight_area=HighlightArea(**highlight_area.model_dump()),
            file_id=file_id,
            text=f"[{citation_nb}]",
            next_chat_comment_id=str(uuid.uuid4()), # currently not used
            thread_id=thread_id,
            message_id=message_id,
        )
        chat_source_comments.append(chat_source_comment)
    return chat_source_comments

        
             