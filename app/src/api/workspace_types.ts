export interface Workspace {
  id: string;
  name: string;
  dirName: string;
  companyName: string;
}
export type SyncStatus = "SYNC_IN_PROGRESS" | "OUT_OF_DATE" | "SYNC_COMPLETE";

export interface WorkspaceFile {
  id: string;
  name: string;
  absolutePath: string;
  workspaceId: string;
  appDir: string[];  // This is the folder path array
  status?: SyncStatus; // TODO: Remove this should map 1:1 with the file_store.py File type.
}

export interface Folder {
  id: string;
  appDir: string[];
  name: string;
  workspaceId: string;
}
