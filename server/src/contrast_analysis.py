import os
from datetime import datetime

from harlus_docs_contrast.graph import ContrastAgentGraph
import uuid
from src.workspace_store import Workspace
from src.file_store import FileStore
from src.tool_library import ToolLibrary
from src.file_types import File




async def analyze(
    old_file_id: str,
    new_file_id: str,
    file_store: FileStore,
    tool_library: ToolLibrary,
    workspace: Workspace,
):
    
    file_id_to_path, old_file_tool, new_file_tool = get_contrast_analysis_inputs(
        old_file_id, 
        new_file_id, 
        file_store, 
        tool_library
    )
    contrast_agent = ContrastAgentGraph(file_id_to_path)
    contrast_agent.update_tools(
        [old_file_tool],
        [new_file_tool],
    )
    contrast_agent.set_thread(uuid.uuid4())
    claim_comments, driver_tree = await contrast_agent.run()
    response_comments = _get_response_comments_from_claim_comments(
        claim_comments,                                                            
        old_file_id, 
        new_file_id, 
        file_store
    )
    return response_comments

def get_contrast_analysis_inputs(
        old_file_id: str, 
        new_file_id: str, 
        file_store: FileStore, 
        tool_library: ToolLibrary
    ) -> ContrastAgentGraph:
    old_file = file_store.get_file(old_file_id)
    new_file = file_store.get_file(new_file_id)

    old_file_doc_search_tool_wrapper = tool_library.get_tool(
        old_file.absolute_path, "doc_search"
    )
    new_file_doc_search_tool_wrapper = tool_library.get_tool(
        new_file.absolute_path, "doc_search"
    )

    file_id_to_path = {old_file_id: old_file.absolute_path, new_file_id: new_file.absolute_path}

    return file_id_to_path, old_file_doc_search_tool_wrapper.get(), new_file_doc_search_tool_wrapper.get()

   
def _get_response_comments_from_claim_comments(claim_comments: list[any], old_file_id: str, new_file_id: str, file_store: FileStore) -> list[any]:
    old_file = file_store.get_file(old_file_id)
    new_file = file_store.get_file(new_file_id)
    response_comments = []
    i = 1
    for comment in claim_comments:
        i = i + 1
        response_comments.append(_get_response_comment_from_claim_comment(comment, old_file, new_file, i))
    return response_comments


def _get_response_comment_from_claim_comment(comment: any, old_file: File, new_file: File, i: int) -> str:
    time_now = datetime.now().isoformat()
    return {
        "id": f"{time_now}_claim_comment_{i}",
        "fileId": comment.file_id,
        "commentGroupId": f"{time_now}_{old_file.name}_{new_file.name}",
        "text": comment.text,
        "highlightArea": {
            "boundingBoxes": [
                {
                    "left": box.left,
                    "top": box.top,
                    "width": box.width,
                    "height": box.height,
                    "page": box.page,
                }
                for box in comment.highlight_area.bounding_boxes
            ],
        },
        "links": [
            {
                "id": f"{time_now}_link_comment_{i}_{j}",
                "fileId": link.file_id,
                "commentGroupId": f"{time_now}_{old_file.name}_{new_file.name}",
                "text": "",
                "highlightArea": {
                    "boundingBoxes": [
                        {
                            "left": box.left,
                            "top": box.top,
                            "width": box.width,
                            "height": box.height,
                            "page": box.page,
                        }
                        for box in link.highlight_area.bounding_boxes
                    ],
                },
                "parentCommentId": f"{time_now}_claim_comment_{i}",
            }
            for j, link in enumerate(comment.links)
            if len(link.highlight_area.bounding_boxes) > 0
        ],
        "verdict": comment.verdict,
    }