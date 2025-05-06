export interface Workspace {
  id: string;
  name: string;
  dirName: string;
}
export type SyncStatus = "SYNC_IN_PROGRESS" | "OUT_OF_DATE" | "SYNC_COMPLETE";

export interface WorkspaceFile {
  id: string;
  name: string;
  absolutePath: string;
  workspaceId: string;
  appDir: string | null;
  status?: SyncStatus; // TODO: Remove this should map 1:1 with the file_store.py File type.
}
