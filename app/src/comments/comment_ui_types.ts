import { ComponentData, ReadonlyComponentData } from "@/core/ui_state";

export interface CommentLink {
  text: string;
  linkToCommentId: string;
}

export interface ReactPdfAnnotation {
  id: string; // typically the text (TODO: see if we can delete this)
  pageNumber: number; // zero-based
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Comment {
  id: string;
  fileId: string;
  groupId: string;
  header?: string;
  body: string;
  author: string;
  timestamp: Date;
  annotations: ReactPdfAnnotation[];
  links: CommentLink[];
  jumpToPageNumber: number;
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


