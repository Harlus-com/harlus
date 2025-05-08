import React, { useState } from "react";
import { History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useComments } from "./useComments";
import { CommentHistory } from "./CommentHistory";
import { cn } from "@/lib/utils";

interface CommentsPanelProps {
  workspaceId: string;
}

export const CommentsPanel: React.FC<CommentsPanelProps> = ({
  workspaceId,
}) => {
  const [showHistory, setShowHistory] = useState(false);
  const { getActiveCommentGroups } = useComments();
  const activeCommentGroups = getActiveCommentGroups(workspaceId);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-gray-100">
        <h2 className="text-sm font-medium text-gray-900">Comments</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowHistory(!showHistory)}
          className={cn(
            "h-6 w-6 p-0",
            showHistory ? "bg-gray-100" : "hover:bg-gray-100"
          )}
        >
          <History className="h-4 w-4" />
        </Button>
      </div>

      {showHistory ? (
        <CommentHistory workspaceId={workspaceId} />
      ) : (
        <div className="flex-1 overflow-y-auto p-4">
          {activeCommentGroups.length > 0 ? (
            <div className="space-y-4">{/* Comment list will go here */}</div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500">No comment group selected</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
