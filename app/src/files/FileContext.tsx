import { fileService } from "@/api/fileService";
import { SyncStatus, WorkspaceFile } from "@/api/workspace_types";
import { createContext, useContext, useEffect, useState } from "react";

interface FileContextType {
  getFiles: () => WorkspaceFile[];
  getFile: (id: string) => WorkspaceFile;
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

  const loadFiles = async () => {
    const files = await fileService.getFiles(workspaceId);
    setFiles(files);
  };

  useEffect(() => {
    loadFiles();
  }, [workspaceId]);

  const notifyFileListChanged = () => {
    loadFiles();
  };

  const getFile = (id: string) => {
    return files.find((file) => file.id === id);
  };

  const getFiles = () => {
    return files;
  };

  return (
    <FileContext.Provider
      value={{
        getFiles,
        getFile,
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
