import { useContext } from "react";
import { CommentsContext } from "./CommentsContext";

export const useComments = () => {
  const context = useContext(CommentsContext);
  if (!context) {
    throw new Error("useComments must be used within a CommentsProvider");
  }
  return context;
}; 