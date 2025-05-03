export interface Workspace {
  id: string;
  name: string;
  dirName: string;
}
export type SyncStatus = "SYNC_IN_PROGRESS" | "OUT_OF_DATE" | "SYNC_COMPLETE";


// REMEMBER THIS HAS TO BE FOR ReactPdfVieiwer, which uses percentages
export interface BoundingBox {
  left: number;
  top: number;
  width: number;
  height: number;
  page: number; // Page where this bounding box get's rendered. Helpful when a highligh area spans multiple pages.
}

export interface HighlightArea {
  boundingBoxes: BoundingBox[]; // Array of bounding boxes that make up the highlight area
  // Page number to jump to when the highlight is clicked note: the comment could span multiplage pages hence "jumpTo"
  jumpToPageNumber: number;
}

export interface ClaimComment {
  id: string;
  fileId: string;
  text: string;
  highlightArea: HighlightArea;
  links: LinkComment[];
  // This is used for formatting
  verdict: "true" | "false" | "unknown";
}

export interface ChatSourceComment {
  id: string;
  fileId: string;
  threadId: string;
  messageId: string; // Could be used to scroll back in the thread to the original message with the source
  text: string; // In original version something generic like "Response source"
  highlightArea: HighlightArea;
  nextChatCommentId: string; // Links to the next source comment associated with the chat 
}


export interface ChatSourceCommentGroup {
  fileId: string;
  chatSourceComments: ChatSourceComment[];
  workspace_file?: WorkspaceFile; // for development purposes, to be removed
}


/*
 * Higlights a specific area of text in a file, and links back to the "origin comment".
 */
interface LinkComment {
  id: string;
  fileId: string;
  text: string; // e.g. Why the text is relevant to the claim in the parent comment
  highlightArea: HighlightArea;
  parentCommentId: string;
}

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
  chatSourceCommentGroups: ChatSourceCommentGroup[];
}

export interface ReactPdfAnnotation {
  id: string; // typically the text
  page: number; // zero-based
  left: number;
  top: number;
  width: number;
  height: number;
}
