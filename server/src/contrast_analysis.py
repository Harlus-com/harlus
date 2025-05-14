import json
import os
import time
from datetime import datetime

from harlus_contrast_tool.api_interfaces import ClaimComment

from src.file_store import FileStore
from src.tool_library import ToolLibrary


cache_file_path_base = "contrast_analysis"
# Set this to the desired cache response
cache_file_path_target = "contrast_analysis_1.json"


def analyze(
    old_file_id: str, new_file_id: str, file_store: FileStore, tool_library: ToolLibrary
):
    old_file = file_store.get_file(old_file_id)
    new_file = file_store.get_file(new_file_id)
    thesis_qengine = tool_library.get_tool(
        old_file.absolute_path, "claim_query_engine_tool"
    )
    thesis_sentence_retriever_tool = tool_library.get_tool(
        old_file.absolute_path, "sentence_retriever_tool"
    )
    update_qengine = tool_library.get_tool(
        new_file.absolute_path, "verdict_query_engine_tool"
    )
    update_sentence_retriever = tool_library.get_tool(
        new_file.absolute_path, "sentence_retriever_tool"
    )
    if os.path.exists(cache_file_path_target):
        time.sleep(3)
        with open(cache_file_path_target, "r") as f:
            comments = json.load(f)
            comments = [ClaimComment(**comment) for comment in comments]
    else:
        comments = tool.run(
            old_file.absolute_path,
            thesis_qengine.get(),
            thesis_sentence_retriever_tool.get(),
            new_file.absolute_path,
            update_qengine.get(),
            update_sentence_retriever.get(),
        )
        for i in range(1, 100):
            new_cache_file_path = f"{cache_file_path_base}_{i}.json"
            if not os.path.exists(new_cache_file_path):
                with open(new_cache_file_path, "w") as f:
                    json.dump(
                        [comment.model_dump() for comment in comments],
                        f,
                        indent=2,
                    )
                break

    response_comments = []
    time_now = datetime.datetime.now().isoformat()
    i = 1
    for comment in comments:
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
