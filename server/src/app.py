import datetime
import json
import shutil
import tempfile
import fastapi
from fastapi import (
    Body,
    FastAPI,
    Form,
    HTTPException,
    Query,
    UploadFile,
)
import os
import asyncio
import nest_asyncio
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from platformdirs import user_data_dir
from pathlib import Path

from pydantic import BaseModel, Field
from src.chat_store import ChatStore, JsonType
from src.comment_store import CommentGroup, CommentStore
from src.tool_library import ToolLibrary

from src.file_store import FileStore, Workspace, File
from src.sync_queue import SyncQueue, SyncType
from src.contrast_analysis import analyze


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

DEV_APP_DATA_PATH = Path(__file__).parent.parent.joinpath("data")

APP_DATA_PATH_STRING = os.environ.get("APP_DATA_PATH")
if not APP_DATA_PATH_STRING:
    APP_DATA_PATH = DEV_APP_DATA_PATH
else:
    APP_DATA_PATH = Path(APP_DATA_PATH_STRING)

print("APP_DATA_PATH", APP_DATA_PATH)

file_store = FileStore(APP_DATA_PATH)

tool_library = ToolLibrary(file_store)
tool_library.load_tools()

chat_store = ChatStore(file_store, tool_library)
comment_store = CommentStore(file_store)
sync_queue = SyncQueue(file_store, tool_library)


@app.get("/file/handle")
def get_file(
    file_id: str = Query(..., alias="fileId"),
    workspace_id: str = Query(..., alias="workspaceId"),
):
    print("Getting file", file_id, "from workspace", workspace_id)
    file = file_store.get_file(file_id, workspace_id)
    return FileResponse(
        path=file.absolute_path,
        filename=file.name,
        # TODO: Determine if we need media_type at all and/or if we can figure it out dynamically
        media_type="application/pdf",
    )


class ForceSyncFileRequest(BaseModel):
    file_id: str = Field(alias="fileId")
    workspace_id: str = Field(alias="workspaceId")
    force: bool = Field(alias="force")


@app.post("/file/sync")
async def force_file_sync(request: ForceSyncFileRequest):
    print("Syncing file", request)
    file = file_store.get_file(request.file_id, request.workspace_id)
    sync_type = SyncType.FORCE if request.force else SyncType.NORMAL
    await sync_queue.queue_model_sync(file, sync_type=sync_type)
    return True


@app.delete("/file/delete")
def delete_file(
    file_id: str = Query(..., alias="fileId"),
    workspace_id: str = Query(..., alias="workspaceId"),
) -> bool:
    print("Deleting file", file_id, "from workspace", workspace_id)
    file = file_store.delete_file(file_id, workspace_id)
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
    initial_file_paths: list[str] = Field(alias="initialFilePaths")


@app.post("/workspace/create")
async def create_workspace(request: CreateWorkspaceRequest):
    print("Creating workspace", request.name)
    workspace = file_store.create_workspace(request.name)
    chat_store.add_workspace(workspace)
    comment_store.add_workspace(workspace)
    for path in request.initial_file_paths:
        if os.path.isdir(path):
            file_store.copy_folder_to_workspace(path, workspace.id)
        else:
            file_store.copy_file_to_workspace(path, workspace.id)
    for file in file_store.get_files(workspace.id).values():
        await sync_queue.queue_model_sync(file)
    return workspace


@app.get("/workspace/get")
def get_workspace(workspace_id: str = Query(..., alias="workspaceId")):
    print("Getting workspace", workspace_id)
    return file_store.get_workspaces()[workspace_id]


@app.get("/workspace/all")
def get_workspaces() -> list[Workspace]:
    workspaces = list(file_store.get_workspaces().values())
    return workspaces


@app.delete("/workspace/delete")
def delete_workspace(workspace_id: str = Query(..., alias="workspaceId")):
    """Delete a workspace and all its associated files"""
    file_store.delete_workspace(workspace_id)


@app.get("/workspace/files")
def get_files(workspace_id: str = Query(..., alias="workspaceId")):
    print("Getting files for workspace", workspace_id)
    files = list(file_store.get_files(workspace_id).values())
    print("Got files, time: ", datetime.datetime.now().isoformat())
    return files


class SyncWorkspaceRequest(BaseModel):
    workspace_id: str = Field(alias="workspaceId")


@app.post("/workspace/sync")
async def sync_workspace(request: SyncWorkspaceRequest):
    print("Syncing workspace", request.workspace_id)
    for file in file_store.get_files(request.workspace_id).values():
        await sync_queue.queue_model_sync(file)
    return True


class SetThreadRequest(BaseModel):
    workspace_id: str = Field(alias="workspaceId")
    thread_id: str = Field(alias="threadId")


@app.post("/chat/set_thread")
def set_thread(request: SetThreadRequest):
    print("Setting thread", request.workspace_id, request.thread_id)
    if not chat_store.thread_exists(request.workspace_id, request.thread_id):
        raise HTTPException(status_code=404, detail="Thread not found")
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
    chat_model = chat_store.get_chat_model(workspace_id, thread_id)
    response = StreamingResponse(
        chat_model.stream(query),
        media_type="text/event-stream",
    )
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Credentials"] = "false"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "*"
    return response


@app.get("/workspace/files/status")
def get_workspace_files_status(workspace_id: str = Query(..., alias="workspaceId")):
    """Get the current sync status of all files in a workspace"""
    print("Getting workspace file statuses", workspace_id)
    return {
        file_id: sync_queue.get_sync_status(file_id)
        for file_id in file_store.get_files(workspace_id).keys()
    }


@app.get("/contrast/analyze")
def get_contrast_analyze(
    old_file_id: str = Query(..., alias="oldFileId"),
    new_file_id: str = Query(..., alias="newFileId"),
):
    """Analyze the contrast between two files"""
    return analyze(old_file_id, new_file_id, file_store, tool_library)


@app.get("/file/get")
def get_file(
    file_id: str = Query(..., alias="fileId"),
    file_path: str = Query(..., alias="filePath"),
):
    print("Getting file from id", file_id, "or path", file_path)
    if file_id:
        return file_store.get_file(file_id)
    elif file_path:
        return file_store.get_file_by_path(file_path)
    else:
        raise HTTPException(status_code=400, detail="No file id or path provided")


@app.post("/chat/history/save")
async def save_chat_history(
    message_pairs=Body(...),
    thread_id: str = Query(..., alias="threadId"),
    workspace_id: str = Query(..., alias="workspaceId"),
):
    await chat_store.save_chat_history(workspace_id, thread_id, message_pairs)
    return True


@app.get("/chat/history")
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
    comment_group: CommentGroup = Field(alias="commentGroup")


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
    """Get saved comments for a workspace"""
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


async def is_pdf_stream(upload: UploadFile) -> bool:
    header = await upload.read(5)
    # Reset the stream cursor so you can read it again later
    await upload.seek(0)
    return header == b"%PDF-"


@app.post("/file/upload")
async def upload_file(
    workspace_id: str = Form(..., alias="workspaceId"),
    app_dir_json: str = Form(..., alias="appDir"),
    upload: UploadFile = fastapi.File(..., alias="file"),
):
    app_dir: list[str] = json.loads(app_dir_json)
    if len(app_dir) != 0:
        file_store.add_folder(app_dir, workspace_id)
    is_pdf = await is_pdf_stream(upload)
    print("is_pdf", is_pdf)

    tmp_dir = tempfile.mkdtemp()
    tmp_path = os.path.join(tmp_dir, upload.filename)
    with open(tmp_path, "wb") as out:
        shutil.copyfileobj(upload.file, out)

    # if not is_pdf:
    #    tmp_path = await convert_to_pdf(Path(tmp_path))

    file = file_store.copy_file_to_workspace(str(tmp_path), workspace_id, app_dir)
    await sync_queue.queue_model_sync(file)
    return file
