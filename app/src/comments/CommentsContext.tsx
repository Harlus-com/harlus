import {
  ChatSourceComment,
  ClaimComment,
  CommentGroupId,
} from "@/api/comment_types";
import { createContext } from "react";
import { ReadonlyComment } from "./comment_ui_types";

interface CommentsContextType {
  addClaimComments: (comments: ClaimComment[], groupId: CommentGroupId) => void;
  addChatSourceComments: (
    comments: ChatSourceComment[],
    groupId: CommentGroupId
  ) => void;
  addCommentGroup: (commentGroupId: CommentGroupId) => void;

  deleteComment: (commentId: string) => void;
  hideComment: (commentId: string) => void;
  setSelectedComment: (commentId: string) => void;

  getAllCommentGroups: (fileId: string) => CommentGroupId[];
  getActiveCommentGroups: (fileId: string) => CommentGroupId[];
  setActiveCommentGroups: (fileId: string, commentGroupIds: string[]) => void;
  /** Get all comments for the active comment groups, including hidden ones */
  getActiveComments: (fileId: string) => ReadonlyComment[];
  /** Get all comments for all comments associated with the file */
  getAllComments: (fileId: string) => ReadonlyComment[];
}

export const CommentsContext = createContext<CommentsContextType | undefined>(
  undefined
);
