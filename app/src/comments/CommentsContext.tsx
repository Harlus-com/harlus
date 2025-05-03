import React, { createContext, useContext, useState, useCallback } from "react";
import { Comment } from "@/api/types";
import { ComponentData, ReadonlyComponentData } from "@/core/ui_state";

interface CommentState {
  isHidden: boolean;
}

interface CommentComponentData extends ComponentData<Comment, CommentState> {}

export type ReadonlyComment = ReadonlyComponentData<Comment, CommentState>;

interface CommentsContextType {
  addComments: (comments: Comment[]) => void;
  addComment: (comment: Comment) => void;
  deleteComment: (commentId: string) => void;
  saveComment: (comment: Comment) => void;
  hideComment: (commentId: string) => void;
  getComments: (fileId: string) => ReadonlyComment[];
}

const CommentsContext = createContext<CommentsContextType | undefined>(
  undefined
);

export const useComments = () => {
  const context = useContext(CommentsContext);
  if (!context) {
    throw new Error("useComments must be used within a CommentsProvider");
  }
  return context;
};

interface CommentsProviderProps {
  children: React.ReactNode;
}

export const CommentsProvider: React.FC<CommentsProviderProps> = ({
  children,
}) => {
  const [comments, setComments] = useState<CommentComponentData[]>([]);

  const createCommentComponentData = (
    comment: Comment
  ): CommentComponentData => ({
    apiData: comment,
    uiState: { isHidden: false },
  });

  const addComments = useCallback((newComments: Comment[]) => {
    setComments((prev) => [
      ...prev,
      ...newComments.map(createCommentComponentData),
    ]);
  }, []);

  const addComment = useCallback((comment: Comment) => {
    setComments((prev) => [...prev, createCommentComponentData(comment)]);
  }, []);

  const saveComment = useCallback((comment: Comment) => {
    // TODO:  Persist via API call
  }, []);

  const deleteComment = useCallback((commentId: string) => {
    setComments((prev) => prev.filter((c) => c.apiData.id !== commentId));
  }, []);

  const hideComment = useCallback((commentId: string) => {
    setComments((prev) =>
      prev.map((c) =>
        c.apiData.id === commentId
          ? {
              apiData: c.apiData,
              uiState: { isHidden: true },
            }
          : c
      )
    );
  }, []);

  const getComments = useCallback(
    (fileId: string): ReadonlyComment[] => {
      return comments
        .filter((c) => c.apiData.fileId === fileId)
        .map((c) => ({
          ...c.apiData,
          ...c.uiState,
        }));
    },
    [comments]
  );

  const value = {
    addComments,
    addComment,
    deleteComment,
    saveComment,
    hideComment,
    getComments,
  };

  return (
    <CommentsContext.Provider value={value}>
      {children}
    </CommentsContext.Provider>
  );
};
