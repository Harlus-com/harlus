import {
  ChatSourceComment,
  ClaimComment,
  CommentGroup,
} from "@/api/comment_types";
import { createContext } from "react";
import { ReadonlyComment } from "./comment_ui_types";

export interface CommentContextAddOptions {
  ignoreIfExists?: boolean;
}

interface CommentsContextType {
  addClaimComments: (
    comments: ClaimComment[],
    group: CommentGroup,
    options: CommentContextAddOptions
  ) => Promise<void>;
  addChatSourceComments: (
    comments: ChatSourceComment[],
    group: CommentGroup,
    options: CommentContextAddOptions
  ) => Promise<void>;
  addCommentGroup: (
    commentGroup: CommentGroup,
    options: CommentContextAddOptions
  ) => void;
  deleteComment: (commentId: string) => void;
  hideComment: (commentId: string) => void;
  setSelectedComment: (commentId: string) => void;

  getAllCommentGroups: (fileId: string) => CommentGroup[];
  getActiveCommentGroups: (fileId: string) => CommentGroup[];
  setActiveCommentGroups: (fileId: string, commentGroupIds: string[]) => void;
  /** Get all comments for the active comment groups, including hidden ones */
  getActiveComments: (fileId: string) => ReadonlyComment[];
  /** Get all comments for all comments associated with the file */
  getAllComments: (fileId: string) => ReadonlyComment[];
  getSelectedComment: (fileId: string) => ReadonlyComment | null;
  deleteCommentGroup: (groupId: string) => void;
  renameCommentGroup: (groupId: string, name: string) => void;
}

export const CommentsContext = createContext<CommentsContextType | undefined>(
  undefined
);
