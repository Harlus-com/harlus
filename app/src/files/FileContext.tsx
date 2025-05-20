import { modelService } from "@/api/model_service";
import { fileService } from "@/api/fileService";
import {
  SyncStatus,
  Workspace,
  WorkspaceFile,
  WorkspaceFolder,
} from "@/api/workspace_types";
import { createContext, useContext, useEffect, useState } from "react";
import { FileStatusManager } from "./file_status_manager";
import { workspaceService } from "@/api/workspaceService";

interface FileContextType {
  getFiles: () => WorkspaceFile[];
  getFolders: () => WorkspaceFolder[];
  getFile: (id: string) => WorkspaceFile;
  getFileSyncStatus: (id: string) => SyncStatus;
  startSyncFile: (fileOrId: WorkspaceFile | string) => void;
  forceSyncFile: (id: string) => void;
  notifyFileListChanged: () => void;
}

const FileContext = createContext<FileContextType | null>(null);

export const useFileContext = () => {
  const context = useContext(FileContext);
  if (!context) {
    throw new Error("useFileContext must be used within a FileContextProvider");
  }
  return context;
};

interface FileContextProviderProps {
  children: React.ReactNode;
  workspaceId: string;
}

export const FileContextProvider: React.FC<FileContextProviderProps> = ({
  children,
  workspaceId,
}) => {
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [folders, setFolders] = useState<WorkspaceFolder[]>([]);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [fileSyncStatuses, setFileSyncStatuses] = useState<
    Record<string, SyncStatus>
  >({});
  const statusManager = new FileStatusManager(workspaceId, (statuses) => {
    setFileSyncStatuses((prev) => {
      if (hasFileSyncStatusesChanged(prev, statuses)) {
        return statuses;
      }
      return prev;
    });
  });
  const loadFiles = async () => {
    console.log("[FileContext] loadFiles", workspaceId);
    const resolvedWorkspace =
      workspace ?? (await workspaceService.getWorkspace(workspaceId));
    if (!workspace) {
      setWorkspace(resolvedWorkspace);
    }
    console.log("RESOLVED WORKSPACE", resolvedWorkspace);
    const files = await fileService.getFiles(resolvedWorkspace);
    const folders = await fileService.getFolders(resolvedWorkspace);
    setFiles(files);
    setFolders(folders);
    setWorkspace(workspace);
  };

  useEffect(() => {
    loadFiles();
  }, [workspaceId]);

  useEffect(() => {
    statusManager.start();
    return () => statusManager.end();
  }, [files]);

  const notifyFileListChanged = () => {
    loadFiles();
  };

  const getFile = (id: string) => {
    return files.find((file) => file.id === id);
  };

  const getFileSyncStatus = (id: string) => {
    console.log("getFileSyncStatus", id, fileSyncStatuses[id]);
    return fileSyncStatuses[id];
  };

  const startSyncFile = async (fileOrId: WorkspaceFile | string) => {
    const file = typeof fileOrId === "string" ? getFile(fileOrId) : fileOrId;
    updateFileSyncStatus(file.id, "SYNC_PENDING");
    // Wait for the server to have processed the request before attempting to poll the status
    await modelService.startSyncFile(file);
    statusManager.start();
  };

  const forceSyncFile = async (id: string) => {
    updateFileSyncStatus(id, "SYNC_PENDING");
    // Wait for the server to have processed the request before attempting to poll the status
    await modelService.forceSyncFile(getFile(id));
    statusManager.start();
  };

  const updateFileSyncStatus = (id: string, status: SyncStatus) => {
    setFileSyncStatuses((prev) => {
      const newStatuses = { ...prev };
      newStatuses[id] = status;
      return newStatuses;
    });
  };

  const getFiles = () => {
    return files;
  };

  const getFolders = () => {
    return folders;
  };

  return (
    <FileContext.Provider
      value={{
        getFiles,
        getFolders,
        getFile,
        getFileSyncStatus,
        startSyncFile,
        forceSyncFile,
        notifyFileListChanged,
      }}
    >
      {children}
    </FileContext.Provider>
  );
};

function hasFileSyncStatusesChanged(
  prev: Record<string, SyncStatus>,
  current: Record<string, SyncStatus>
) {
  for (const [key, value] of Object.entries(prev)) {
    if (value !== current[key]) {
      return true;
    }
  }
  for (const [key, value] of Object.entries(current)) {
    if (value !== prev[key]) {
      return true;
    }
  }
  return false;
}
