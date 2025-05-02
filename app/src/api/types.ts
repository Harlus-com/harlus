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
  annotations?: {
    show: boolean;
    data?: any[]; // You can define a more specific type for your annotations
  };
  status?: SyncStatus;
  // tempAnnotations: any[]; propose to set this property with annotations which the backend injects
  // persistedAnnotations: any[]; propose to set this property with annotations which the user made
}

export interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  content: string;
  timestamp: Date;
  sources?: Array<{
    file_name: string;
    pages: number[];
    file_path: string;
    file_id: string;
    bboxes: any[];
  }>;
}

export interface ReactPdfAnnotation {
  id: string; // typically the text
  page: number; // zero-based
  left: number;
  top: number;
  width: number;
  height: number;
}
