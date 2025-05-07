import {
  ChatSourceComment,
  ClaimComment,
  CommentGroup,
} from "@/api/comment_types";
import { createContext } from "react";
import { ReadonlyComment } from "./comment_ui_types";

interface CommentsContextType {
  addClaimComments: (
    comments: ClaimComment[],
    group: CommentGroup
  ) => Promise<void>;
  // TODO: make robust for case that comment already exists
  addChatSourceComments: (
    comments: ChatSourceComment[],
    group: CommentGroup
  ) => Promise<void>;
  addCommentGroup: (commentGroup: CommentGroup) => void;

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
}

export const CommentsContext = createContext<CommentsContextType | undefined>(
  undefined
);
