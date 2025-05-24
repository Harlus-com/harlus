import {
  ChatSourceComment,
  ClaimComment,
  CommentGroup,
} from "@/api/comment_types";
import React, { useEffect, useState } from "react";
import {
  CommentComponentData,
  ReadonlyComment,
  Comment,
  CommentColor,
} from "./comment_ui_types";
import {
  CommentConverter,
  convertChatSourceCommentToComments,
} from "./comment_converters";
import { getCommentColor, updateUiState, copyToReadonly } from "./comment_util";
import { CommentContextAddOptions, CommentsContext } from "./CommentsContext";
import { flushSync } from "react-dom";
import { commentService } from "./comment_service";
import { useFileContext } from "@/files/FileContext";

interface CommentsProviderProps {
  children: React.ReactNode;
  workspaceId: string;
}

export const CommentsProvider: React.FC<CommentsProviderProps> = ({
  children,
  workspaceId,
}) => {
  const [comments, setComments] = useState<{
    [key: string]: CommentComponentData;
  }>({});
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(
    null
  );
  const [activeCommentGroups, setActiveCommentGroups] = useState<string[]>([]);
  const [commentGroups, setCommentGroups] = useState<CommentGroup[]>([]);
  const getFile = useFileContext().getFile;
  const commentConverter = new CommentConverter(getFile);
  useEffect(() => {
    const loadComments = async () => {
      const comments = await commentService.getAllSavedComments(workspaceId);
      const commentGroups = await commentService.getAllCommentGroups(
        workspaceId
      );
      const commentsById: { [key: string]: CommentComponentData } = {};
      comments.forEach((comment) => {
        commentsById[comment.apiData.id] = {
          apiData: comment.apiData,
          uiState: {
            isHidden: false,
            highlightColor: "yellow",
            color: comment.uiState.color,
          },
        };
      });
      setComments(commentsById);
      setCommentGroups(commentGroups);
    };
    loadComments();
  }, [workspaceId]);

  const updateComments = (
    updates: { [key: string]: CommentComponentData },
    options: {
      replacePrevious?: boolean;
      expectAllNew?: boolean;
      expectReplace?: boolean;
      save?: boolean;
    } = {}
  ) => {
    setComments((prevComments) => {
      if (options.replacePrevious) {
        prevComments = {};
      } else if (options.expectAllNew) {
        Object.keys(updates).forEach((key) => {
          if (prevComments[key]) {
            throw new Error(`Comment with id ${key} already exists`);
          }
        });
      } else if (options.expectReplace) {
        Object.keys(updates).forEach((key) => {
          if (!prevComments[key]) {
            throw new Error(`Comment with id ${key} does not exist`);
          }
        });
      }
      const newComments = { ...prevComments, ...updates };
      if (options.save) {
        commentService.saveComments(workspaceId, Object.values(newComments));
      }
      return newComments;
    });
  };

  const addClaimComments = async (
    claims: ClaimComment[],
    group: CommentGroup,
    options: CommentContextAddOptions
  ) => {
    const newComments: Comment[] = (
      await Promise.all(
        claims.map((claim) =>
          commentConverter.convertClaimCommentToComments(claim, group)
        )
      )
    ).flat();
    const claimsById: { [key: string]: ClaimComment } = {};
    claims.forEach((claim) => {
      claimsById[claim.id] = claim;
    });
    const commentComponentData: CommentComponentData[] = newComments.map(
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
      if (options.ignoreIfExists && comments[comment.apiData.id]) {
        continue;
      }
      updates[comment.apiData.id] = comment;
    }
    updateComments(updates, { expectAllNew: true, save: true });
  };

  const addChatSourceComments = async (
    chatSourceComments: ChatSourceComment[],
    group: CommentGroup,
    options: CommentContextAddOptions
  ) => {
    const convertedComments: Comment[] = (
      await Promise.all(
        chatSourceComments.map((comment) =>
          convertChatSourceCommentToComments(comment, group)
        )
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
    updateComments(updates, {
      save: true,
      replacePrevious: true,
    });
  };

  const addCommentGroup = async (
    commentGroup: CommentGroup,
    options: CommentContextAddOptions
  ) => {
    if (options.ignoreIfExists) {
      const existingGroup = commentGroups.find(
        (group) => group.id === commentGroup.id
      );
      if (existingGroup) {
        return;
      }
    }
    await commentService.createIfNotExists(workspaceId, commentGroup);
    flushSync(() => {
      setCommentGroups((prev) => [...prev, commentGroup]);
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

  const getAllCommentGroups = (): CommentGroup[] => {
    return commentGroups;
  };

  const getActiveCommentGroups = (): CommentGroup[] => {
    return commentGroups.filter((group) =>
      activeCommentGroups.includes(group.id)
    );
  };

  const getActiveComments = (fileId: string): ReadonlyComment[] => {
    console.log("Getting active comments for file", fileId);
    return Object.values(comments)
      .filter((comment) => comment.apiData.fileId === fileId)
      .filter((comment) =>
        activeCommentGroups.includes(comment.apiData.groupId)
      )
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

  const deleteCommentGroup = async (groupId: string) => {
    await commentService.deleteCommentGroup(workspaceId, groupId);
    setCommentGroups((prev) => prev.filter((group) => group.id !== groupId));
    setActiveCommentGroups((prev) => prev.filter((id) => id !== groupId));
    setComments((prev) => {
      const newComments = { ...prev };
      for (const commentId in newComments) {
        if (newComments[commentId].apiData.groupId === groupId) {
          delete newComments[commentId];
        }
      }
      return newComments;
    });
  };

  const renameCommentGroup = async (groupId: string, name: string) => {
    const newCommentGroup = await commentService.renameCommentGroup(
      workspaceId,
      groupId,
      name
    );
    setCommentGroups((prev) =>
      prev.map((group) => (group.id === groupId ? newCommentGroup : group))
    );
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
    deleteCommentGroup,
    renameCommentGroup,
  };

  return (
    <CommentsContext.Provider value={value}>
      {children}
    </CommentsContext.Provider>
  );
};
