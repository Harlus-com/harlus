import {
  ChatSourceComment,
  ClaimComment,
  CommentGroupId,
} from "@/api/comment_types";
import React, { createContext, useContext, useState } from "react";
import { CommentComponentData, ReadonlyComment, Comment } from "./comment_ui_types";
import { convertClaimCommentToComments } from "./comment_converters";
import { getCommentColor, updateUiState, copyToReadonly } from "./comment_util";
import { CommentsContext } from "./CommentsContext";



interface CommentsProviderProps {
  children: React.ReactNode;
}

export const CommentsProvider: React.FC<CommentsProviderProps> = ({
  children,
}) => {
  const [comments, setComments] = useState<CommentComponentData[]>([]);
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(
    null
  );
  const [activeCommentGroupIds, setActiveCommentGroupsIds] = useState<{
    [key: string]: string[];
  }>({});
  const [commentGroups, setCommentGroups] = useState<CommentGroupId[]>([]);

  const findComment = (commentId: string): CommentComponentData | null => {
    return comments.find((comment) => comment.apiData.id === commentId) || null;
  };

  const replaceWith = (comment: CommentComponentData) => {
    setComments((prevComments) =>
      prevComments.map((c) => (c.apiData.id === comment.apiData.id ? comment : c))
    );
  };

  const addClaimComments = async (
    claims: ClaimComment[],
    groupId: CommentGroupId
  ) => {
    const comments: Comment[] = (
      await Promise.all(
        claims.map((claim) => convertClaimCommentToComments(claim, groupId))
      )
    ).flat();
    const claimsById: { [key: string]: ClaimComment } = {};
    claims.forEach((claim) => {
      claimsById[claim.id] = claim;
    });
    const commentComponentData: CommentComponentData[] = comments.map(
      (comment) => ({
        apiData: comment,
        uiState: {
          isHidden: false,
          highlightColor: "yellow",
          color: getCommentColor(claimsById[comment.id]),
        },
      })
    );
    setComments((prevComments) => [...prevComments, ...commentComponentData]);
  };

  const addChatSourceComments = async (comments: ChatSourceComment[]) => {
    // TODO
  };

  const addCommentGroup = (commentGroupId: CommentGroupId) => {
    // TODO: Determine if this should also persist the group to the server
    setCommentGroups((prevCommentGroups) => [
      ...prevCommentGroups,
      commentGroupId,
    ]);
  };

  const deleteComment = (commentId: string) => {
    // TODO
  };

  const hideComment = (commentId: string) => {
    const comment = comments.find(
      (comment) => comment.apiData.id === commentId
    );
    if (comment) {
      replaceWith(updateUiState(comment, { isHidden: true }));
    }
  };

  const setSelectedComment = (commentId: string) => {
    const oldSelectedComment = findComment(selectedCommentId);
    const newSelectedComment = findComment(commentId);
    if (oldSelectedComment) {
      replaceWith(updateUiState(oldSelectedComment, {
        highlightColor: "yellow",
      }));
    }
    if (newSelectedComment) {
      replaceWith(updateUiState(newSelectedComment, {
        highlightColor: "green",
      }));
    }
    setSelectedCommentId(commentId);
  };

  const getAllCommentGroups = (fileId: string): CommentGroupId[] => {
    const fileComments = comments.filter(
      (comment) => comment.apiData.fileId === fileId
    );
    const groupIds = Array.from(
      new Set(fileComments.map((comment) => comment.apiData.groupId))
    );
    const groupIdToGroup: { [key: string]: CommentGroupId } = {};
    commentGroups.forEach((group) => {
      groupIdToGroup[group.id] = group;
    });
    return groupIds.map((id) => groupIdToGroup[id]);
  };

  const getActiveCommentGroups = (fileId: string): CommentGroupId[] => {
    const allGroups = getAllCommentGroups(fileId);
    const activeGroups = activeCommentGroupIds[fileId] || [];
    return allGroups.filter((group) => activeGroups.includes(group.id));
  };

  const setActiveCommentGroups = (fileId: string, groupIds: string[]) => {
    setActiveCommentGroupsIds((prevActiveCommentGroupsIds) => ({
      ...prevActiveCommentGroupsIds,
      [fileId]: groupIds,
    }));
  };

  const getActiveComments = (fileId: string): ReadonlyComment[] => {
    const activeGroups = activeCommentGroupIds[fileId] || [];
    return comments
      .filter((comment) => activeGroups.includes(comment.apiData.groupId))
      .map(copyToReadonly);
  };

  const getAllComments = (fileId: string): ReadonlyComment[] => {
    return comments
      .filter((comment) => comment.apiData.fileId === fileId)
      .map(copyToReadonly);
  };

  const value = {
    addClaimComments,
    addChatSourceComments,
    addCommentGroup,
    deleteComment,
    hideComment,
    setSelectedComment,
    getAllCommentGroups,
    getActiveCommentGroups,
    setActiveCommentGroups,
    getActiveComments,
    getAllComments,
  };

  return (
    <CommentsContext.Provider value={value}>
      {children}
    </CommentsContext.Provider>
  );
};

