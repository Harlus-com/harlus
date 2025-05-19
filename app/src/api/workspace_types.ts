export interface Workspace {
  id: string;
  name: string;
  dirName: string;
}
export type SyncStatus =
  | "SYNC_COMPLETE"
  | "SYNC_IN_PROGRESS"
  | "SYNC_PENDING"
  | "SYNC_ERROR"
  | "UNKNOWN";

export interface WorkspaceFile {
  id: string;
  name: string;
  absolutePath: string;
  workspaceId: string;
  appDir: string[];
}

export interface WorkspaceFolder {
  id: string;
  name: string;
  workspaceId: string;
  appDir: string[];
}
