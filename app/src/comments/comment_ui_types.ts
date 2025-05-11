import { ComponentData, ReadonlyComponentData } from "@/core/ui_state";
import { HighlightArea } from "@react-pdf-viewer/highlight";

export interface CommentLink {
  text: string;
  linkToCommentId: string;
  linkToFileId: string;
  linkToPageNumber: number;
}

export enum CommentTag {
  ALIGNMENT = "Alignment",
  CONTRADICTION = "Contradiction",
  SOURCE = "Source",
}

export interface Comment {
  id: string;
  fileId: string;
  groupId: string;
  tag?: CommentTag;
  body: string;
  author: string;
  timestamp: Date;
  annotations: HighlightArea[];
  links: CommentLink[];
}

export interface CommentState {
  isHidden: boolean;
  highlightColor: string;
  color: CommentColor; // In the future we could add more styling options
}

export enum CommentColor {
  GREEN,
  RED,
  NONE,
}

export type CommentComponentData = ComponentData<Comment, CommentState>;

export type ReadonlyComment = ReadonlyComponentData<Comment, CommentState>;
