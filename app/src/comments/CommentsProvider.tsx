import {
  ChatSourceComment,
  ClaimComment,
  CommentGroup,
} from "@/api/comment_types";
import React, { useState } from "react";
import {
  CommentComponentData,
  ReadonlyComment,
  Comment,
  CommentColor,
} from "./comment_ui_types";
import { convertClaimCommentToComments } from "./comment_converters";
import { getCommentColor, updateUiState, copyToReadonly } from "./comment_util";
import { CommentsContext } from "./CommentsContext";
import { flushSync } from "react-dom";

interface CommentsProviderProps {
  children: React.ReactNode;
}

export const CommentsProvider: React.FC<CommentsProviderProps> = ({
  children,
}) => {
  const [comments, setComments] = useState<{
    [key: string]: CommentComponentData;
  }>({});
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(
    null
  );
  const [activeCommentGroups, setActiveCommentGroupsIds] = useState<{
    [key: string]: string[];
  }>({});
  const [commentGroups, setCommentGroups] = useState<CommentGroup[]>([]);

  const updateComments = (
    updates: { [key: string]: CommentComponentData },
    options: { expectAllNew?: boolean; expectReplace?: boolean } = {}
  ) => {
    setComments((prevComments) => {
      if (options.expectAllNew) {
        Object.keys(updates).forEach((key) => {
          if (prevComments[key]) {
            throw new Error(`Comment with id ${key} already exists`);
          }
        });
      }
      if (options.expectReplace) {
        Object.keys(updates).forEach((key) => {
          if (!prevComments[key]) {
            throw new Error(`Comment with id ${key} does not exist`);
          }
        });
      }
      return { ...prevComments, ...updates };
    });
  };

  const addClaimComments = async (
    claims: ClaimComment[],
    group: CommentGroup
  ) => {
    const comments: Comment[] = (
      await Promise.all(
        claims.map((claim) => convertClaimCommentToComments(claim, group))
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
          color: claimsById[comment.id]
            ? getCommentColor(claimsById[comment.id])
            : CommentColor.NONE,
        },
      })
    );
    const updates: { [key: string]: CommentComponentData } = {};
    for (const comment of commentComponentData) {
      updates[comment.apiData.id] = comment;
    }
    updateComments(updates, { expectAllNew: true });
  };

  const addChatSourceComments = async (
    comments: ChatSourceComment[],
    group: CommentGroup
  ) => {
    // TODO
  };

  const addCommentGroup = (commentGroup: CommentGroup) => {
    // TODO: Determine if this should also persist the group to the server
    flushSync(() => {
      setCommentGroups((prevCommentGroups) => [
        ...prevCommentGroups,
        commentGroup,
      ]);
    });
  };

  const deleteComment = (commentId: string) => {
    // TODO
  };

  const hideComment = (commentId: string) => {
    const comment = comments[commentId];
    if (comment) {
      const updates: { [key: string]: CommentComponentData } = {};
      updates[commentId] = updateUiState(comment, { isHidden: true });
      updateComments(updates, { expectReplace: true });
    }
  };

  const setSelectedComment = (commentId: string) => {
    const oldSelectedComment = comments[selectedCommentId];
    const newSelectedComment = comments[commentId];
    const updates: { [key: string]: CommentComponentData } = {};
    if (oldSelectedComment) {
      updates[selectedCommentId] = updateUiState(oldSelectedComment, {
        highlightColor: "yellow",
      });
    }
    if (newSelectedComment) {
      updates[commentId] = updateUiState(newSelectedComment, {
        highlightColor: "green",
      });
    }
    updateComments(updates, { expectReplace: true });
    setSelectedCommentId(commentId);
  };

  const getAllCommentGroups = (fileId: string): CommentGroup[] => {
    const fileComments = Object.values(comments).filter(
      (comment) => comment.apiData.fileId === fileId
    );
    const groupIds = Array.from(
      new Set(fileComments.map((comment) => comment.apiData.groupId))
    );
    const groupIdToGroup: { [key: string]: CommentGroup } = {};
    commentGroups.forEach((group) => {
      groupIdToGroup[group.id] = group;
    });
    return groupIds.map((id) => groupIdToGroup[id]);
  };

  const getActiveCommentGroups = (fileId: string): CommentGroup[] => {
    const allGroups = getAllCommentGroups(fileId);
    const activeGroups = activeCommentGroups[fileId] || [];
    return allGroups.filter((group) => activeGroups.includes(group.id));
  };

  const setActiveCommentGroups = (fileId: string, groupIds: string[]) => {
    setActiveCommentGroupsIds((prevActiveCommentGroupsIds) => ({
      ...prevActiveCommentGroupsIds,
      [fileId]: groupIds,
    }));
  };

  const getActiveComments = (fileId: string): ReadonlyComment[] => {
    const activeGroups = activeCommentGroups[fileId] || [];
    return Object.values(comments)
      .filter((comment) => comment.apiData.fileId === fileId)
      .filter((comment) => activeGroups.includes(comment.apiData.groupId))
      .map(copyToReadonly);
  };

  const getAllComments = (fileId: string): ReadonlyComment[] => {
    return Object.values(comments)
      .filter((comment) => comment.apiData.fileId === fileId)
      .map(copyToReadonly);
  };

  const getSelectedComment = (fileId: string): ReadonlyComment | null => {
    if (!selectedCommentId) {
      return null;
    }
    const comment = comments[selectedCommentId];
    if (comment && comment.apiData.fileId === fileId) {
      return copyToReadonly(comment);
    }
    return null;
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
    getSelectedComment,
  };

  return (
    <CommentsContext.Provider value={value}>
      {children}
    </CommentsContext.Provider>
  );
};
