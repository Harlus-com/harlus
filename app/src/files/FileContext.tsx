import { modelService } from "@/api/model_service";
import { fileService } from "@/api/fileService";
import { SyncStatus, WorkspaceFile } from "@/api/workspace_types";
import { createContext, useContext, useEffect, useState } from "react";
import { FileStatusManager } from "./file_status_manager";

interface FileContextType {
  getFiles: () => WorkspaceFile[];
  getFile: (id: string) => WorkspaceFile;
  getFileSyncStatus: (id: string) => SyncStatus;
  startSyncFile: (id: string) => void;
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
    const files = await fileService.getFiles(workspaceId);
    setFiles(files);
  };

  useEffect(() => {
    loadFiles();
  }, [workspaceId]);

  useEffect(() => {
    statusManager.start();
    return () => statusManager.end();
  }, [workspaceId]);

  const notifyFileListChanged = () => {
    loadFiles();
  };

  const getFile = (id: string) => {
    return files.find((file) => file.id === id);
  };

  const getFileSyncStatus = (id: string) => {
    return fileSyncStatuses[id];
  };

  const startSyncFile = (id: string) => {
    updateFileSyncStatus(id, "SYNC_PENDING");
    modelService.startSyncFile(getFile(id));
    statusManager.start();
  };

  const forceSyncFile = (id: string) => {
    updateFileSyncStatus(id, "SYNC_PENDING");
    modelService.forceSyncFile(getFile(id));
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

  return (
    <FileContext.Provider
      value={{
        getFiles,
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
