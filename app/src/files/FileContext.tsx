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
import { toWorkspaceFile } from "./file_util";

interface FileContextType {
  getFiles: () => WorkspaceFile[];
  getFolders: () => WorkspaceFolder[];
  getLocalFolder: (path: string[]) => LocalFolder | null;
  getFile: (id: string) => WorkspaceFile;
  getFileSyncStatus: (id: string) => SyncStatus;
  startSyncFile: (localFile: LocalFile) => void;
  forceSyncFile: (localFile: LocalFile) => void;
  notifyFileListChanged: () => void;
  notifyFileSyncStatusChanged: () => void;
  workspaceFileToLocalFile: (workspaceFile: WorkspaceFile) => LocalFile | null;
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
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [folders, setFolders] = useState<LocalFolder[]>([]);
  const [workspaceFolders, setWorkspaceFolders] = useState<WorkspaceFolder[]>(
    []
  );
  const [workspaceFiles, setWorkspaceFiles] = useState<WorkspaceFile[]>([]);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [fileSyncStatuses, setFileSyncStatuses] = useState<
    Record<string, SyncStatus>
  >({});
  const statusManager = new FileStatusManager(workspaceId, (statuses) => {
    setFileSyncStatuses((prev) => {
      const newStatus: Record<string, SyncStatus> = {};
      for (const file of files) {
        newStatus[file.contentHash] = statuses[file.contentHash] || "UNTRACKED";
      }
      if (hasFileSyncStatusesChanged(prev, newStatus)) {
        return newStatus;
      }
      return prev;
    });
  });

  const loadFiles = async (workspace: Workspace) => {
    const files = await fileService.getLocalFiles(workspace);
    const folders = await fileService.getLocalFolders(workspace);
    fileService.updateServerDirectories(workspaceId, files);
    setFiles(files);
    setFolders(folders);
    setWorkspaceFiles(files.map((file) => toWorkspaceFile(workspaceId, file)));
    setWorkspaceFolders(
      folders.map((folder) => ({
        workspaceId: workspaceId,
        appDir: folder.pathRelativeToWorkspace,
      }))
    );
  };

  useEffect(() => {
    workspaceService.getWorkspace(workspaceId).then(setWorkspace);
  }, [workspaceId]);

  useEffect(() => {
    if (workspace) {
      loadFiles(workspace);
      workspaceService.watchWorkspace(workspace, {
        onStructureChange: () => loadFiles(workspace),
      });
    }
    return () => {
      if (workspace) {
        workspaceService.unwatchWorkspace(workspace);
      }
    };
  }, [workspace]);

  useEffect(() => {
    statusManager.start();
    return () => statusManager.end();
  }, [files]);

  const notifyFileListChanged = () => {
    if (!workspace) {
      return;
    }
    loadFiles(workspace);
  };

  const getFile = (id: string) => {
    const localFile = files.find((file) => file.contentHash === id);
    return localFile ? toWorkspaceFile(workspaceId, localFile) : null;
  };

  const getFileSyncStatus = (id: string) => {
    return fileSyncStatuses[id];
  };

  const startSyncFile = async (localFile: LocalFile) => {
    updateFileSyncStatus(localFile.contentHash, "SYNC_PENDING");
    await modelService.startSyncFile(workspaceId, localFile);
    // Wait for the server to have processed the request before attempting to poll the status
    statusManager.start();
  };

  const forceSyncFile = async (localFile: LocalFile) => {
    updateFileSyncStatus(localFile.contentHash, "SYNC_PENDING");
    await modelService.forceSyncFile(workspaceId, localFile);
    // Wait for the server to have processed the request before attempting to poll the status
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
    return workspaceFiles;
  };

  const getFolders = () => {
    return workspaceFolders;
  };

  const getLocalFolder = (path: string[]) => {
    if (path.length === 0 && workspace) {
      return {
        absolutePath: workspace.localDir,
        pathRelativeToWorkspace: [],
      };
    }
    return folders.find(
      (folder) => folder.pathRelativeToWorkspace.join("/") === path.join("/")
    );
  };
  const notifyFileSyncStatusChanged = () => {
    statusManager.start();
  };

  /**
   * If a given local file has not been synced to the server, this function will return null.
   *
   * It's also possible a file was synced to the server, but later deleted, renamed, changed (so that its content hash changed)
   * and that could cause this function to return null.
   */
  const workspaceFileToLocalFile = (workspaceFile: WorkspaceFile) => {
    const localFile = files.find(
      (file) => file.contentHash === workspaceFile.id
    );
    if (!localFile) {
      return null;
    }
    return localFile;
  };

  return (
    <FileContext.Provider
      value={{
        getFiles,
        getFolders,
        getLocalFolder,
        getFile,
        getFileSyncStatus,
        startSyncFile,
        forceSyncFile,
        notifyFileListChanged,
        notifyFileSyncStatusChanged,
        workspaceFileToLocalFile,
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
