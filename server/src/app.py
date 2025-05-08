import datetime
import json
import time
from fastapi import (
    Body,
    FastAPI,
    HTTPException,
    Query,
    Response,
    WebSocket,
)
import os
import asyncio
import nest_asyncio
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from openai import OpenAI
from platformdirs import user_data_dir
from pathlib import Path
from llama_index.core.agent.workflow import ReActAgent

from pydantic import BaseModel, ConfigDict, Field
from src.chat_store import ChatStore, JsonType
from src.comment_store import CommentGroup, CommentStore, Timestamp
from src.util import BoundingBoxConverter, snake_to_camel
from src.tool_library import ToolLibrary
from src.sync_workspace import get_workspace_sync_manager

# from src.stream_response import stream_generator_v2 # TODO: Delete this file
from src.file_store import FileStore, Workspace, File
from src.sync_queue import SyncQueue, SyncType
from src.stream_manager import StreamManager
from src.sync_status import SyncStatus
from src.chat_library import ChatLibrary
from harlus_contrast_tool import ContrastTool, ClaimComment


app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

asyncio.set_event_loop_policy(asyncio.DefaultEventLoopPolicy())


nest_asyncio.apply(asyncio)

DEV_APP_DATA_PATH = Path(user_data_dir("Electron")).joinpath("Harlus")

# On MacOs for development this will be something like
# /Users/danielglasgow/Library/Application Support/Electron
# TODO: Determine what this will be in production
# Probably something like /Users/danielglasgow/Library/Application Support/Harlus
# Also need to determine what this will be for Windows
# Ultimately this value is passed in by the Electron app in prod.
APP_DATA_PATH_STRING = os.environ.get("APP_DATA_PATH")
if (
    not APP_DATA_PATH_STRING
    or "Electron" in APP_DATA_PATH_STRING
    or "electron" in APP_DATA_PATH_STRING
):
    APP_DATA_PATH = DEV_APP_DATA_PATH
else:
    APP_DATA_PATH = Path(APP_DATA_PATH_STRING)

print("APP_DATA_PATH", APP_DATA_PATH)

file_store = FileStore(APP_DATA_PATH)

tool_library = ToolLibrary(file_store)
tool_library.load_tools()

chat_store = ChatStore(file_store)
comment_store = CommentStore(file_store)


# TODO: chat_library should call update_chat_tools when new tools
# are added to the tool_library to ensure chat has access to all tools
# within the workspace.
# TODO: (also mentioned in chat/stream). We should integrate the frontend to start new threads.
# TODO: Once we start having longer conversations, we should summarize the history regularly.
chat_library = ChatLibrary(file_store, tool_library, chat_store)
chat_library.load()  # initialize a chat for each workspace, load from disk to memory

stream_manager = StreamManager(file_store)

sync_queue = SyncQueue(stream_manager, file_store, tool_library)


@app.websocket("/workspace/events/stream/{workspace_id}")
async def websocket_workspace_events(websocket: WebSocket, workspace_id: str):
    """WebSocket endpoint for streaming workspace events"""
    workspace_sync_manager = get_workspace_sync_manager(
        stream_manager, sync_queue, file_store, workspace_id
    )
    await workspace_sync_manager.open(websocket)


@app.get("/workspace/events/stream/close/{workspace_id}")
async def close_workspace_events(workspace_id: str):
    """Close the workspace events stream"""
    workspace_sync_manager = get_workspace_sync_manager(
        stream_manager, sync_queue, file_store, workspace_id
    )
    await workspace_sync_manager.close()


@app.get("/file/handle/{file_id}")
def get_file(
    file_id: str,
    workspace_id: str = Query(..., description="The id of the workspace"),
):
    print("Getting file", file_id, "from workspace", workspace_id)
    file = file_store.get_file(file_id, workspace_id)
    return FileResponse(
        path=file.absolute_path,
        filename=file.name,
        # TODO: Determine if we need media_type at all and/or if we can figure it out dynamically
        media_type="application/pdf",
    )


@app.api_route("/file/apryse/pdf/{file_id}", methods=["GET", "HEAD"])
def get_pdf_from_file_id(
    file_id: str,
    ignored_path: str = Query(
        ...,
        alias="path",
        description="Absolute path to the local file. This is actually ignored. Just a placeholder for Apryse.",
    ),
    stream: bool = Query(
        False, description="Whether to stream the file or send it in one go"
    ),
):

    file = file_store.get_file(file_id)
    path = file.absolute_path
    file_size = os.path.getsize(path)
    headers = {
        "Accept-Ranges": "bytes",
        "Content-Length": str(file_size),
        "Content-Disposition": f'attachment; filename="{os.path.basename(path)}"',
    }

    if stream:
        return FileResponse(
            path=path,
            filename=os.path.basename(path),
            media_type="application/pdf",
            headers=headers,
            chunk_size=8192,  # 8KB chunks for better streaming
        )
    else:
        with open(path, "rb") as f:
            content = f.read()
        return Response(content=content, media_type="application/pdf", headers=headers)


class LoadFileRequest(BaseModel):
    path: str
    workspace_id: str = Field(alias="workspaceId")


@app.post("/file/load")
async def load_file(request: LoadFileRequest):
    path = request.path
    workspace_id = request.workspace_id
    print("Loading file", path, "to workspace", workspace_id)
    if not os.path.isfile(path):
        return JSONResponse(
            status_code=404, content={"error": f"File not found: {path}"}
        )
    file = file_store.copy_file_to_workspace(path, workspace_id)
    await sync_queue.queue_model_sync(file)
    return file


class ForceSyncFileRequest(BaseModel):
    file_id: str = Field(alias="fileId")


@app.post("/file/force_sync")
async def force_file_sync(request: ForceSyncFileRequest):
    print("Force syncing file", request.file_id)
    file = file_store.get_file(request.file_id)
    await sync_queue.queue_model_sync(file, sync_type=SyncType.FORCE)
    return True


@app.delete("/file/delete/{file_id}")
def delete_file(file_id: str) -> bool:
    print("Deleting file", file_id)
    file = file_store.delete_file(file_id)
    if file is None:
        return False
    tool_library.delete_file_tools(file)
    return True


class LoadFolderRequest(BaseModel):
    path: str
    workspace_id: str = Field(alias="workspaceId")


@app.post("/folder/load")
def load_folder(request: LoadFolderRequest):
    path = request.path
    workspace_id = request.workspace_id
    print("Loading folder", path, "to workspace", workspace_id)
    if not os.path.isdir(path):
        return JSONResponse(
            status_code=404, content={"error": f"Folder not found: {path}"}
        )
    return file_store.copy_folder_to_workspace(path, workspace_id)


class CreateWorkspaceRequest(BaseModel):
    name: str


@app.post("/workspace/create")
def create_workspace(request: CreateWorkspaceRequest):
    print("Creating workspace", request.name)
    return file_store.create_workspace(request.name)


@app.get("/workspace/get/{workspace_id}")
def get_workspace(workspace_id: str):
    print("Getting workspace", workspace_id)
    return file_store.get_workspaces()[workspace_id]


@app.get("/workspace/status/{workspace_id}")
def get_workspace_status(workspace_id: str):
    """Get the current sync status of a workspace"""
    workspace_sync_manager = get_workspace_sync_manager(
        stream_manager, sync_queue, file_store, workspace_id
    )
    return workspace_sync_manager.get_workspace_status()


@app.get("/workspace/all")
def get_workspaces() -> list[Workspace]:
    print("Getting all workspaces")
    workspaces = list(file_store.get_workspaces().values())
    print("Workspaces", workspaces)
    return workspaces


@app.get("/workspace/files/{workspace_id}")
def get_files(workspace_id: str) -> list[File]:
    print("Getting files for workspace", workspace_id)
    return list(file_store.get_files(workspace_id).values())


class SyncWorkspaceRequest(BaseModel):
    workspace_id: str = Field(alias="workspaceId")


@app.post("/workspace/sync")
async def sync_workspace(request: SyncWorkspaceRequest):
    print("Syncing workspace", request.workspace_id)
    workspace_sync_manager = get_workspace_sync_manager(
        stream_manager, sync_queue, file_store, request.workspace_id
    )
    await workspace_sync_manager.sync_workspace()
    return True


SYSTEM_PROMPT = """
        - Structure your response, use tables where possible. 
        - Use all available sources (tools) which can be helpful. 
        - Do not summarize your response. 
        - Answer in English, do not mention which language you are using in your response. 
        - Set a new line after the Thought and Action and Action Input. 
        - In Thought. State your intention. Think what sources (tools) you need to read (use). Structure those in bullet points. Format these sources in a reader friendly format (based on the tool name) for example: "I will read the following SEC filings for Apple \n - 10-K report from November 2024 \n - 10-K report from November 2023 \n - 10-K report from November 2022".
        """


class SetThreadRequest(BaseModel):
    workspace_id: str = Field(alias="workspaceId")
    thread_id: str = Field(alias="threadId")


@app.post("/chat/set_thread")
def set_thread(request: SetThreadRequest):
    print("Setting thread", request.workspace_id, request.thread_id)
    if not chat_store.thread_exists(request.workspace_id, request.thread_id):
        raise HTTPException(status_code=404, detail="Thread not found")
    chat_library.set_thread(request.workspace_id, request.thread_id)
    return chat_store.get_thread(request.workspace_id, request.thread_id)


@app.get("/chat/threads")
def get_threads(workspace_id: str = Query(..., alias="workspaceId")):
    print("Getting threads", workspace_id)
    return {"threads": chat_store.get_threads(workspace_id)}


@app.get("/chat/stream")
async def stream_chat(
    workspace_id: str = Query(..., alias="workspaceId"),
    query: str = Query(...),
    thread_id: str = Query(..., alias="threadId"),
):
    print("Streaming chat", workspace_id, query, thread_id)
    # TODO: add endpoint to manage threads
    # A new thread can be started by calling chat_model.start_new_thread()
    # A thread can be resumed by calling chat_model.resume_thread(thread_id)
    # A list of threads can be retrieved by calling chat_model.get_thread_ids()
    chat_model = chat_library.get_and_resume_thread(workspace_id, thread_id)
    response = StreamingResponse(
        chat_model.stream(query),
        media_type="text/event-stream",
    )
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Credentials"] = "false"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "*"
    return response


@app.get("/file/model/status/{file_id}")
def get_file_model_status(file_id: str) -> SyncStatus:
    """Get the sync status of a file's model"""
    return sync_queue.get_sync_status(file_id)


@app.get("/file/get/status/{file_id}")
def get_file_status(file_id: str) -> SyncStatus:
    """Get the current sync status of a file"""
    return sync_queue.get_sync_status(file_id)


class ReactPdfAnnotation(BaseModel):
    id: str  # typically the text TODO: See if we can delete this
    page: int  # zero-based
    left: float
    top: float
    width: float
    height: float


cache_file_path_base = "contrast_analysis"
# Set this to the desired cache response
cache_file_path_target = ""


@app.get("/contrast/analyze")
def get_contrast_analyze(
    old_file_id: str = Query(..., alias="oldFileId"),
    new_file_id: str = Query(..., alias="newFileId"),
):
    """Analyze the contrast between two files"""
    tool = ContrastTool()

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


@app.get("/file/get_from_path")
def get_file_from_path(
    file_path: str = Query(..., description="The absolute path of the file"),
):
    print("Getting file from path", file_path)
    """Get file object from file path by searching through all workspaces"""
    return file_store.get_file_by_path(file_path)


@app.get("/file/get/{file_id}")
def get_file_from_id(file_id: str):
    print("Getting file from id", file_id)
    return file_store.get_file(file_id)


@app.post("/chat/save_history")
async def save_chat_history(
    message_pairs=Body(...),
    thread_id: str = Query(..., alias="threadId"),
    workspace_id: str = Query(..., alias="workspaceId"),
):
    await chat_store.save_chat_history(workspace_id, thread_id, message_pairs)
    return True


@app.get("/chat/get_history")
def get_chat_history(
    thread_id: str = Query(..., alias="threadId"),
    workspace_id: str = Query(..., alias="workspaceId"),
):
    print("Getting chat history", thread_id, workspace_id)
    return chat_store.get_chat_history(workspace_id, thread_id)


class UpsertThreadRequest(BaseModel):
    workspace_id: str = Field(alias="workspaceId")
    thread_id: str = Field(alias="threadId")
    title: str


@app.post("/chat/thread/upsert")
def upsert_thread(
    request: UpsertThreadRequest = Body(...),
):
    print("Upserting thread", request)
    if not chat_store.thread_exists(request.workspace_id, request.thread_id):
        chat_store.create_thread(request.workspace_id, request.thread_id, request.title)
    else:
        chat_store.rename_thread(request.workspace_id, request.thread_id, request.title)
    return chat_store.get_thread(request.workspace_id, request.thread_id)


@app.delete("/chat/thread")
def delete_thread(
    thread_id: str = Query(..., alias="threadId"),
    workspace_id: str = Query(..., alias="workspaceId"),
):
    print("Deleting thread", thread_id, workspace_id)
    return chat_store.delete_thread(workspace_id, thread_id)


@app.get("/chat/thread")
def get_thread(
    thread_id: str = Query(..., alias="threadId"),
    workspace_id: str = Query(..., alias="workspaceId"),
):
    print("Getting thread", thread_id, workspace_id)
    return chat_store.get_thread(workspace_id, thread_id)


class CreateCommentGroupRequest(BaseModel):
    workspace_id: str = Field(alias="workspaceId")
    comment_group: CommentGroup


class RenameCommentGroupRequest(BaseModel):
    workspace_id: str = Field(alias="workspaceId")
    comment_group_id: str = Field(alias="commentGroupId")
    name: str


class DeleteCommentGroupRequest(BaseModel):
    workspace_id: str = Field(alias="workspaceId")
    comment_group_id: str = Field(alias="commentGroupId")


class SaveCommentsRequest(BaseModel):
    workspace_id: str = Field(alias="workspaceId")
    comments: list[JsonType]


@app.post("/comments/group/create")
def create_comment_group(request: CreateCommentGroupRequest):
    """Create a new comment group"""
    comment_store.create_comment_group(request.workspace_id, request.comment_group)
    return request.comment_group


@app.get("/comments/group/get")
def get_comment_group(
    group_id: str = Query(..., alias="groupId"),
    workspace_id: str = Query(..., alias="workspaceId"),
):
    """Get a comment group by ID"""
    return comment_store.get_comment_group(workspace_id, group_id)


@app.get("/comments/group/all")
def get_all_comment_groups(
    workspace_id: str = Query(..., alias="workspaceId"),
):
    """Get all comment groups for a workspace"""
    return comment_store.get_comment_groups(workspace_id)


@app.post("/comments/save")
async def save_comments(request: SaveCommentsRequest):
    """Save comments for a group"""
    await comment_store.save_comments(request.workspace_id, request.comments)
    return True


@app.get("/comments/saved")
def get_saved_comments(
    workspace_id: str = Query(..., alias="workspaceId"),
):
    """Get saved comments for a group"""
    return comment_store.get_comments(workspace_id)


@app.post("/comments/group/rename")
def rename_comment_group(request: RenameCommentGroupRequest):
    """Rename a comment group"""
    comment_store.rename_comment_group(
        request.workspace_id, request.comment_group_id, request.name
    )
    return comment_store.get_comment_group(
        request.workspace_id, request.comment_group_id
    )


@app.post("/comments/group/delete")
def delete_comment_group(request: DeleteCommentGroupRequest):
    """Delete a comment group"""
    comment_store.delete_comment_group(request.workspace_id, request.comment_group_id)
    return True
