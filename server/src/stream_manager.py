from typing import Dict, Set, Callable, Awaitable
from fastapi import WebSocket, WebSocketDisconnect
from fastapi.websockets import WebSocketState
from src.file_store import File, FileStore
from src.sync_status import SyncStatus


class StreamManager:
    def __init__(self, file_store: FileStore):
        self.file_store: FileStore = file_store
        self.workspace_connections: dict[str, set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, workspace_id: str):
        """Connect a WebSocket client to a workspace stream"""
        try:
            await websocket.accept()
            if workspace_id not in self.workspace_connections:
                self.workspace_connections[workspace_id] = set()
            self.workspace_connections[workspace_id].add(websocket)
            while True:
                # Keep the connection alive
                data = await websocket.receive_text()
                print("Received data", data)
                # Echo back to confirm connection is still alive
                if websocket.client_state == WebSocketState.CONNECTED:
                    await websocket.send_json({"ping": "pong"})
        except WebSocketDisconnect:
            print("WebSocket disconnected")
            await self._disconnect_internal(websocket, workspace_id)
        except Exception as e:
            print(f"WebSocket error: {e}")
            await self._disconnect_internal(websocket, workspace_id)

    async def disconnect(self, workspace_id: str):
        """Disconnect a WebSocket client from a workspace stream"""
        if workspace_id in self.workspace_connections:
            for websocket in self.workspace_connections[workspace_id]:
                await self._disconnect_internal(
                    websocket,
                    iterating=True,
                )
            del self.workspace_connections[workspace_id]

    async def _disconnect_internal(self, websocket: WebSocket, iterating=False):
        try:
            if websocket.client_state != WebSocketState.DISCONNECTED:
                await websocket.close()
            if not iterating:
                for workspace_connections in self.workspace_connections.values():
                    if websocket in workspace_connections:
                        workspace_connections.discard(websocket)

        except Exception as e:
            print(f"Error closing WebSocket: {e}")

    async def broadcast_workspace_status(self, workspace_id: str, status: SyncStatus):
        """Broadcast workspace status to all connected clients"""
        if workspace_id in self.workspace_connections:
            for websocket in self.workspace_connections[workspace_id]:
                try:
                    await websocket.send_json(
                        {"status": status.value, "type": "workspace"}
                    )
                except Exception as e:
                    print(f"Error broadcasting workspace status: {e}")
        else:
            print("No workspace connections for", workspace_id)

    async def broadcast_file_status(self, file: File, status: SyncStatus):
        """Broadcast file status to all connected clients"""
        print("Broadcasting file status", file.id, status)
        if file.workspace_id in self.workspace_connections:
            for websocket in self.workspace_connections[file.workspace_id]:
                try:
                    await websocket.send_json(
                        {"file_id": file.id, "status": status.value, "type": "file"}
                    )
                except Exception as e:
                    print(f"Error broadcasting file status: {e}")
        else:
            print("No file connections for workspace", file.workspace_id)
