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
import { convertChatSourceCommentToComments, convertClaimCommentToComments } from "./comment_converters";
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
    // TODO: could we add an option to create comments if they don't exist for a commentgroupid and update them if they exist? 
    // This would simplify adding chat source comments (the source button can be clicked multiple times).
    // In the current state, the second click on the same source throws an error.
    //
    // ChatSourceComments could also have a property which only adds the comment on open and does not persist them (in session or on disk).
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
    // Filter out invalid comments
    const validComments = comments.filter(comment => {

      if (!comment.highlightArea) {
        console.warn("Missing highlight area in chat source comment:", comment);
        return false;
      }
      
      if (!comment.highlightArea.boundingBoxes || !Array.isArray(comment.highlightArea.boundingBoxes)) {
        console.warn("Missing or invalid bounding boxes in chat source comment:", comment);
        return false;
      }
      
      const validBoundingBoxes = comment.highlightArea.boundingBoxes.every(bbox => {
        if (!bbox || typeof bbox !== 'object') {
          console.warn("Invalid bounding box object:", bbox);
          return false;
        }
        
        if (bbox.page === undefined || 
            bbox.left === undefined || 
            bbox.top === undefined || 
            bbox.width === undefined || 
            bbox.height === undefined) {
          console.warn("Incomplete bounding box properties:", bbox);
          return false;
        }
        
        return true;
      });
      
      if (!validBoundingBoxes) {
        console.warn("Invalid bounding boxes in comment:", comment.id);
        return false;
      }
      
      if (comment.highlightArea.jumpToPageNumber === undefined) {
        console.warn("Missing jumpToPageNumber in chat source comment:", comment);
        return false;
      }
      
      return true;
    });
    
    if (validComments.length === 0) {
      console.warn("No valid chat source comments to add");
      return;
    }
    
    const convertedComments: Comment[] = (
      await Promise.all(
        validComments.map((comment) => convertChatSourceCommentToComments(comment, group))
      )
    ).flat();
    
    const commentComponentData: CommentComponentData[] = convertedComments.map(
      (comment) => ({
        apiData: comment,
        uiState: {
          isHidden: false,
          highlightColor: "blue", // Use blue for source highlights
          color: CommentColor.NONE,
        },
      })
    );
    
    const updates: { [key: string]: CommentComponentData } = {};
    for (const comment of commentComponentData) {
      updates[comment.apiData.id] = comment;
    }
    
    updateComments(updates, { expectAllNew: true });
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
