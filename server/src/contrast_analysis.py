import os
from datetime import datetime

from harlus_contrast_tool.graph import ContrastAgentGraph

from src.file_store import FileStore, Workspace
from src.tool_library import ToolLibrary

cache_file_path_base = "contrast_analysis"


async def analyze(
    old_file_id: str, 
    new_file_id: str, 
    file_store: FileStore, 
    tool_library: ToolLibrary,
    workspace: Workspace
):
    old_file = file_store.get_file(old_file_id)
    new_file = file_store.get_file(new_file_id)


    old_file_doc_search_tool = tool_library.get_tool(
        old_file.absolute_path, "doc_search"
    )
    new_file_doc_search_tool = tool_library.get_tool(
        new_file.absolute_path, "doc_search"
    )

    thread_id = f"{old_file_id}_{new_file_id}"
    contrast_dir = os.path.join(workspace.absolute_path, cache_file_path_base)
    contrast_agent = ContrastAgentGraph(persist_dir=contrast_dir)
    contrast_agent.update_tools([old_file_doc_search_tool], [new_file_doc_search_tool])
    contrast_agent.set_thread(thread_id)

   
    claim_comments = await contrast_agent.run(
        f"What impact does {new_file.absolute_path} have on {old_file.absolute_path}?"
    )

    response_comments = []
    time_now = datetime.datetime.now().isoformat()
    i = 1
    for comment in claim_comments:
        i = i + 1
        response_comments.append(
            {
                "id": f"{time_now}_claim_comment_{i}",
                "filePath": comment.file_path,
                "commentGroupId": f"{time_now}_{old_file.name}_{new_file.name}",
                "text": comment.text,
                "highlightArea": {
                    "boundingBoxes": [
                        {
                            "left": box.left,
                            "top": box.top,
                            "width": box.width,
                            "height": box.height,
                            "page": box.page - 1,  # Zero Based
                        }
                        for box in comment.highlight_area.bounding_boxes
                    ],
                },
                "links": [
                    {
                        "id": f"{time_now}_link_comment_{i}_{j}",
                        "filePath": link.file_path,
                        "commentGroupId": f"{time_now}_{old_file.name}_{new_file.name}",
                        "text": "",
                        "highlightArea": {
                            "boundingBoxes": [
                                {
                                    "left": box.left,
                                    "top": box.top,
                                    "width": box.width,
                                    "height": box.height,
                                    "page": box.page - 1,  # Zero Based
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
        )

    return response_comments
