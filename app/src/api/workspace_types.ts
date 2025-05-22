export interface Workspace {
  readonly id: string;
  readonly name: string;
  readonly localDir: string;
  readonly localDirParts: string[];
}
export type SyncStatus =
  | "SYNC_COMPLETE"
  | "SYNC_INCOMPLETE"
  | "SYNC_IN_PROGRESS"
  | "SYNC_PENDING"
  | "SYNC_ERROR"
  | "SYNC_PARTIAL_SUCCESS"
  | "SYNC_NOT_STARTED"
  | "UNTRACKED";

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
