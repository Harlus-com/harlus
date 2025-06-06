import datetime
import json
import fastapi
from fastapi import (
    Body,
    FastAPI,
    Form,
    HTTPException,
    Query,
    UploadFile,
    APIRouter,
)
import os
import asyncio
import nest_asyncio
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from pathlib import Path

from pydantic import BaseModel, Field
from src.workspace_store import WorkspaceStore, Workspace
from src.file_upload import FileUploader
from src.chat_store import ChatStore, JsonType
from src.comment_store import CommentGroup, CommentStore
from src.tool_library import ToolLibrary

from src.file_store import FileStore
from src.file_types import LocalFile
from src.sync_queue import SyncQueue, SyncType
from src.contrast_analysis import analyze
from src.web_loader import OpenBBLoader, SeleniumLoader

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt
import httpx

TENANT_ID = "27dfce8d-8b21-4c81-8579-2baedebea216"
API_AUDIENCE_URI = "api://6acbb67d-3153-4ed6-8041-f2c52a5a68e4"

JWKS_URL = f"https://login.microsoftonline.com/{TENANT_ID}/discovery/v2.0/keys"
jwks = httpx.get(JWKS_URL).json()

bearer = HTTPBearer()


def validate_jwt(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> dict:
    token = credentials.credentials
    return validate_token(token)


def validate_token(token: str) -> dict:
    try:
        claims = jwt.decode(
            token,
            jwks,
            algorithms=["RS256"],
            audience=API_AUDIENCE_URI,
        )
    except jwt.JWTError as e:
        print("JWT validation error:", str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token validation failed: {e}",
        )

    # We could choose not to enforce scope, but we might want scopes in the future, so just leaving it as an example
    if "scp" not in claims or "Harlus.All" not in claims["scp"].split():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Token missing required scope"
        )

    return claims


app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Router for authenticated endpoints
api_router = APIRouter(dependencies=[Depends(validate_jwt)])

asyncio.set_event_loop_policy(asyncio.DefaultEventLoopPolicy())


nest_asyncio.apply(asyncio)

DEV_APP_DATA_PATH = Path(__file__).parent.parent.joinpath("data")

APP_DATA_PATH_STRING = os.environ.get("APP_DATA_PATH")
if not APP_DATA_PATH_STRING:
    APP_DATA_PATH = DEV_APP_DATA_PATH
else:
    APP_DATA_PATH = Path(APP_DATA_PATH_STRING)

workspace_store = WorkspaceStore(APP_DATA_PATH)
workspace_store.initialize()
file_store = FileStore(workspace_store)
file_store.initialize()
tool_library = ToolLibrary(file_store)
chat_store = ChatStore(workspace_store, file_store, tool_library)
comment_store = CommentStore(workspace_store, file_store)
sync_queue = SyncQueue(file_store, tool_library)


@app.get("/healthz")
def health_check():
    return JSONResponse(content={"status": "ok"})


@api_router.get("/file/is_uploaded")
def is_uploaded(file_id: str = Query(..., alias="fileId")):
    return file_store.find_file(file_id) is not None


class SyncFileRequest(BaseModel):
    file_id: str = Field(alias="fileId")
    workspace_id: str = Field(alias="workspaceId")


@api_router.post("/file/sync")
async def file_sync(request: SyncFileRequest):
    print("Syncing file", request)
    file = file_store.get_file(request.file_id, request.workspace_id)
    await sync_queue.queue_model_sync(file, sync_type=SyncType.NORMAL)
    return True


@api_router.delete("/file/delete")
def delete_file(
    file_id: str = Query(..., alias="fileId"),
    workspace_id: str = Query(..., alias="workspaceId"),
) -> bool:
    print("Deleting file", file_id, "from workspace", workspace_id)
    file_store.delete_file(file_id, workspace_id)
    return True


class CreateWorkspaceRequest(BaseModel):
    name: str
    local_dir: str = Field(alias="localDir")


@api_router.post("/workspace/create")
async def create_workspace(request: CreateWorkspaceRequest):
    print("Creating workspace", request.name)
    workspace = workspace_store.create_workspace(request.name, request.local_dir)
    chat_store.add_workspace(workspace)
    comment_store.add_workspace(workspace)
    return workspace


@api_router.get("/workspace/get")
def get_workspace(workspace_id: str = Query(..., alias="workspaceId")):
    return workspace_store.get_workspaces()[workspace_id]


@api_router.get("/workspace/all")
def get_workspaces() -> list[Workspace]:
    workspaces = list(workspace_store.get_workspaces().values())
    return workspaces


@api_router.delete("/workspace/delete")
def delete_workspace(workspace_id: str = Query(..., alias="workspaceId")):
    """Delete a workspace and all its associated files"""
    workspace_store.delete_workspace(workspace_id)


@api_router.get("/workspace/files")
def get_files(workspace_id: str = Query(..., alias="workspaceId")):
    print("Getting files for workspace", workspace_id)
    files = list(file_store.get_files(workspace_id).values())
    print("Got files, time: ", datetime.datetime.now().isoformat())
    return files


class SyncWorkspaceRequest(BaseModel):
    workspace_id: str = Field(alias="workspaceId")


class SetThreadRequest(BaseModel):
    workspace_id: str = Field(alias="workspaceId")
    thread_id: str = Field(alias="threadId")


@api_router.post("/chat/set_thread")
def set_thread(request: SetThreadRequest):
    print("Setting thread", request.workspace_id, request.thread_id)
    if not chat_store.thread_exists(request.workspace_id, request.thread_id):
        raise HTTPException(status_code=404, detail="Thread not found")
    return chat_store.get_thread(request.workspace_id, request.thread_id)


@api_router.get("/chat/threads")
def get_threads(workspace_id: str = Query(..., alias="workspaceId")):
    print("Getting threads", workspace_id)
    return {"threads": chat_store.get_threads(workspace_id)}


@app.get("/chat/stream")
async def stream_chat(
    workspace_id: str = Query(..., alias="workspaceId"),
    query: str = Query(...),
    thread_id: str = Query(..., alias="threadId"),
    token: str = Query(...),
):
    # Validate the token
    if not validate_token(token):
        raise HTTPException(status_code=403, detail="Invalid or expired token")

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


@api_router.get("/workspace/files/status")
def get_workspace_files_status(workspace_id: str = Query(..., alias="workspaceId")):
    """Get the current sync status of all files in a workspace"""
    return {
        file_id: sync_queue.get_sync_status(file_id)
        for file_id in file_store.get_files(workspace_id).keys()
    }


class UpdateServerDirectoriesRequest(BaseModel):
    workspace_id: str = Field(alias="workspaceId")
    files: list[LocalFile] = Field(alias="files")


@api_router.post("/update_server_directories")
def update_server_directories(request: UpdateServerDirectoriesRequest):
    """Update the server directories for a workspace"""
    file_store.update_server_directories(request.workspace_id, request.files)
    return True


@api_router.get("/contrast/analyze")
async def get_contrast_analyze(
    old_file_id: str = Query(..., alias="oldFileId"),
    new_file_id: str = Query(..., alias="newFileId"),
    workspace_id: str = Query(..., alias="workspaceId"),
):
    """Analyze the contrast between two files"""
    workspace = workspace_store.get_workspaces()[workspace_id]
    return await analyze(old_file_id, new_file_id, file_store, tool_library, workspace)


@api_router.get("/file/get")
def get_file(
    file_path: str = Query(..., alias="filePath"),
):
    return file_store.get_file_by_path(file_path)


@api_router.post("/chat/history/save")
async def save_chat_history(
    message_pairs=Body(...),
    thread_id: str = Query(..., alias="threadId"),
    workspace_id: str = Query(..., alias="workspaceId"),
):
    await chat_store.save_chat_history(workspace_id, thread_id, message_pairs)
    return True


@api_router.get("/chat/history")
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


@api_router.post("/chat/thread/upsert")
def upsert_thread(
    request: UpsertThreadRequest = Body(...),
):
    print("Upserting thread", request)
    if not chat_store.thread_exists(request.workspace_id, request.thread_id):
        chat_store.create_thread(request.workspace_id, request.thread_id, request.title)
    else:
        chat_store.rename_thread(request.workspace_id, request.thread_id, request.title)
    return chat_store.get_thread(request.workspace_id, request.thread_id)


@api_router.delete("/chat/thread")
def delete_thread(
    thread_id: str = Query(..., alias="threadId"),
    workspace_id: str = Query(..., alias="workspaceId"),
):
    print("Deleting thread", thread_id, workspace_id)
    return chat_store.delete_thread(workspace_id, thread_id)


@api_router.get("/chat/thread")
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


@api_router.post("/comments/group/create")
def create_comment_group(request: CreateCommentGroupRequest):
    """Create a new comment group"""
    comment_store.create_comment_group(request.workspace_id, request.comment_group)
    return request.comment_group


@api_router.get("/comments/group/get")
def get_comment_group(
    group_id: str = Query(..., alias="groupId"),
    workspace_id: str = Query(..., alias="workspaceId"),
):
    """Get a comment group by ID"""
    return comment_store.get_comment_group(workspace_id, group_id)


@api_router.get("/comments/group/all")
def get_all_comment_groups(
    workspace_id: str = Query(..., alias="workspaceId"),
):
    """Get all comment groups for a workspace"""
    return comment_store.get_comment_groups(workspace_id)


@api_router.post("/comments/save")
async def save_comments(request: SaveCommentsRequest):
    """Save comments for a group"""
    await comment_store.save_comments(request.workspace_id, request.comments)
    return True


@api_router.get("/comments/saved")
def get_saved_comments(
    workspace_id: str = Query(..., alias="workspaceId"),
):
    """Get saved comments for a workspace"""
    return comment_store.get_comments(workspace_id)


@api_router.post("/comments/group/rename")
def rename_comment_group(request: RenameCommentGroupRequest):
    """Rename a comment group"""
    comment_store.rename_comment_group(
        request.workspace_id, request.comment_group_id, request.name
    )
    return comment_store.get_comment_group(
        request.workspace_id, request.comment_group_id
    )


@api_router.post("/comments/group/delete")
def delete_comment_group(request: DeleteCommentGroupRequest):
    """Delete a comment group"""
    comment_store.delete_comment_group(request.workspace_id, request.comment_group_id)
    return True


@api_router.get("/file/all")
def get_all_files(workspace_id: str = Query(..., alias="workspaceId")):
    """Get all files for a workspace"""
    return list(file_store.get_files(workspace_id).values())


@api_router.post("/file/upload")
async def upload_file(
    workspace_id: str = Form(..., alias="workspaceId"),
    app_dir_json: str = Form(..., alias="appDir"),
    content_hash: str = Form(..., alias="contentHash"),
    upload: UploadFile = fastapi.File(..., alias="file"),
):
    app_dir: list[str] = json.loads(app_dir_json)
    file_uploader = FileUploader(file_store)
    return await file_uploader.upload_file(workspace_id, app_dir, content_hash, upload)



@api_router.get("/workspace/{workspace_name}/online_files")
async def list_online_files(
    workspace_name: str,
    start_date: str = Query(..., alias="startDate"),
):
    return OpenBBLoader().get_available_files(
        ticker=workspace_name, # assuming workspace name is ticker
        start_date=datetime.datetime.strptime(start_date, "%Y-%m-%d").date()
    )


@api_router.get("/file/download_pdf_from_url")
async def download_pdf_from_url(
    url: str = Query(..., alias="url"),
):
    try:
        pdf_content = SeleniumLoader().get_pdf(url)
    except Exception as e:
        print(f"Error fetching with Selenium from {url}: {e}")
        pdf_content = None

    def iter_chunks(data: bytes, chunk_size: int = 1024 * 1024):
        for i in range(0, len(data), chunk_size):
            yield data[i : i + chunk_size]

    return StreamingResponse(iter_chunks(pdf_content), media_type="application/pdf")


class MoveFileRequest(BaseModel):
    workspace_id: str = Field(alias="workspaceId")
    file_id: str = Field(alias="fileId")
    new_parent_dir: list[str] = Field(alias="newParentDir")


@api_router.post("/workspace/move_file")
def move_file(request: MoveFileRequest):
    file_store.move_file(request.workspace_id, request.file_id, request.new_parent_dir)


app.include_router(api_router)
