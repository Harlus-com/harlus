from concurrent.futures import ThreadPoolExecutor
from fastapi import (
    FastAPI,
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

from pydantic import BaseModel, Field
from src.tool_library import ToolLibrary
from src.sync_workspace import get_workspace_sync_manager
from src.stream_response import stream_generator_v2
from src.file_store import FileStore, Workspace, File
from src.sync_queue import SyncQueue
from src.stream_manager import StreamManager
from src.sync_status import SyncStatus

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
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


@app.get("/file/get/{file_id}")
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


@app.delete("/file/delete/{file_id}")
def delete_file(file_id: str) -> bool:
    print("Deleting file", file_id)
    file = file_store.delete_file(file_id)
    if file is None:
        return False
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


@app.get("/chat/stream")
async def stream_chat(
    workspace_id: str = Query(..., alias="workspaceId"), query: str = Query(...)
):
    metadata_list = [
        {
            "file_type": "pdf",  # TODO: Stop hardcoding this
            "file_name": file.name,
            "file_path": file.absolute_path,
        }
        for file in file_store.get_files(workspace_id).values()
    ]
    agent = ReActAgent(
        tools=tool_library.get_tools(),
        llm=OpenAI(model="gpt-4o-mini"),
        name="test_agent",
        description="test_description",
    )
    handler = agent.run(query + " " + SYSTEM_PROMPT)
    response = StreamingResponse(
        stream_generator_v2(handler, file_store.get_file_path_to_id(workspace_id)),
        media_type="text/event-stream",
    )
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Credentials"] = "true"
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


def queue_all_files(self):
    """Queue all files in all workspaces for syncing"""
    workspaces = file_store.get_workspaces()
    for workspace in workspaces.values():
        files = file_store.get_files(workspace.id)
        for file in files.values():
            sync_queue.queue_file_sync(file.id)
