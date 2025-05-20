export interface Workspace {
  id: string;
  name: string;
  localDir: string;
}
export type SyncStatus =
  | "SYNC_COMPLETE"
  | "SYNC_IN_PROGRESS"
  | "SYNC_PENDING"
  | "SYNC_ERROR"
  | "UNKNOWN";

export interface WorkspaceFile {
  id: string; // This should be renamed contentHash (maybe?)
  name: string;
  workspaceId: string;
  appDir: string[];
}

export interface WorkspaceFolder {
  workspaceId: string;
  appDir: string[];
}
