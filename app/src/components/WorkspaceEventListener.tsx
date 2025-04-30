import { WEBSOCKET_URL } from "@/api/client";
import { SyncStatus } from "@/api/types";
import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";

interface WorkspaceEventListenerProps {
  onStatusChange: (status: SyncStatus) => void;
  onFileStatusChange: (fileId: string, status: SyncStatus) => void;
}

const WorkspaceEventListener: React.FC<WorkspaceEventListenerProps> = ({
  onStatusChange,
  onFileStatusChange,
}) => {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const socketRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const cleanupSocket = () => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  };

  useEffect(() => {
    console.log("Connecting to workspace", workspaceId);
    if (socketRef.current) {
      console.warn(
        "Remounting WorkspaceEventListener, but found previous socket had not been cleaned up."
      );
      cleanupSocket();
    }
    const ws = new WebSocket(
      WEBSOCKET_URL + `/workspace/events/stream/${workspaceId}`
    );
    socketRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket connected");
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        }
      }, 30000);
    };

    ws.onmessage = (event) => {
      try {
        console.log("Received message", event.data);
        const data = JSON.parse(event.data);
        if (data.type === "file") {
          onFileStatusChange(data.file_id, data.status as SyncStatus);
        } else if (data.type === "workspace") {
          const newStatus = data.status as SyncStatus;
          onStatusChange(newStatus);
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    ws.onclose = (data) => {
      console.log("WebSocket closed", data);
      if (reconnectAttempts > 5) return;
      cleanupSocket();
      setTimeout(() => {
        setReconnectAttempts(reconnectAttempts + 1);
      }, 5000);
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    return () => {
      const state = socketRef.current?.readyState;
      if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) {
        cleanupSocket();
      }
    };
  }, [workspaceId, onStatusChange, onFileStatusChange, reconnectAttempts]);

  return null;
};

export default WorkspaceEventListener;
