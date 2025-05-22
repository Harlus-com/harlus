import os
from datetime import datetime

from harlus_docs_contrast.graph import ContrastAgentGraph
import uuid
from src.file_store import FileStore, Workspace
from src.tool_library import ToolLibrary
import pickle
import json
cache_file_path_base = "contrast_analysis"


async def analyze(
    old_file_id: str, 
    new_file_id: str, 
    file_store: FileStore, 
    tool_library: ToolLibrary,
    workspace_id: str
):
    workspace = file_store.get_workspaces()[workspace_id]
    old_file = file_store.get_file(old_file_id)
    new_file = file_store.get_file(new_file_id)

    old_file_doc_search_tool_wrapper = tool_library.get_tool(
        old_file.absolute_path, "doc_search"
    )
    new_file_doc_search_tool_wrapper = tool_library.get_tool(
        new_file.absolute_path, "doc_search"
    )

    thread_id = f"{old_file_id}_{new_file_id}_{uuid.uuid4()}"
    contrast_agent = ContrastAgentGraph()
    contrast_agent.update_tools([old_file_doc_search_tool_wrapper.get()], [new_file_doc_search_tool_wrapper.get()])
    contrast_agent.set_thread(thread_id)

   
    cache_file_path = os.path.join(f"{old_file_id}_{new_file_id}")
    
    if os.path.exists(cache_file_path):
        claim_comments = pickle.load(open(os.path.join(cache_file_path, "claim_comments.pkl"), "rb"))
        driver_tree = json.load(open(os.path.join(cache_file_path, "driver_tree.json"), "r"))
    else:
        claim_comments, driver_tree = await contrast_agent.run(
            f"What impact does {new_file.absolute_path} have on {old_file.absolute_path}?"
        )
        pickle.dump(claim_comments, open(f"{cache_file_path}_claim_comments.pkl", "wb"))
        json.dump(driver_tree, open(f"{cache_file_path}_driver_tree.json", "w"))



    response_comments = []
    time_now = datetime.now().isoformat()
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
                            "page": box.page, 
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
        )
    return response_comments
