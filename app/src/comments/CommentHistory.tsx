import React, { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useComments } from "./useComments";
import { formatTimestamp } from "@/api/api_util";

interface CommentHistoryProps {
  workspaceId: string;
}

export const CommentHistory: React.FC<CommentHistoryProps> = ({
  workspaceId,
}) => {
  const {
    getAllCommentGroups,
    getActiveCommentGroups,
    setActiveCommentGroups,
    deleteCommentGroup,
    renameCommentGroup,
  } = useComments();
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState("");
  const commentGroups = getAllCommentGroups(workspaceId);
  const activeCommentGroups = getActiveCommentGroups(workspaceId);
  const activeCommentGroupIds = activeCommentGroups.map((group) => group.id);

  return (
    <div className="border-b border-gray-100">
      <div className="px-3.5 py-2 space-y-1">
        {commentGroups.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-gray-500">No comment groups yet</p>
          </div>
        ) : (
          commentGroups.map((group) => (
            <div
              key={group.id}
              className={cn(
                "group flex items-center justify-between p-2 rounded-md hover:bg-gray-50 transition-colors",
                activeCommentGroupIds.includes(group.id)
                  ? "bg-blue-50 border border-blue-200"
                  : ""
              )}
            >
              {editingGroupId === group.id ? (
                <input
                  type="text"
                  value={editingGroupName}
                  onChange={(e) => setEditingGroupName(e.target.value)}
                  onBlur={() => {
                    if (editingGroupName.trim()) {
                      renameCommentGroup(group.id, editingGroupName.trim());
                      setEditingGroupId(null);
                      setEditingGroupName("");
                    } else {
                      setEditingGroupId(null);
                      setEditingGroupName("");
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && editingGroupName.trim()) {
                      renameCommentGroup(group.id, editingGroupName.trim());
                      setEditingGroupId(null);
                      setEditingGroupName("");
                    } else if (e.key === "Escape") {
                      setEditingGroupId(null);
                      setEditingGroupName("");
                    }
                  }}
                  className={cn(
                    "flex-1 text-sm bg-transparent border-none focus:ring-0",
                    activeCommentGroupIds.includes(group.id)
                      ? "text-blue-700"
                      : "text-gray-700"
                  )}
                  autoFocus
                />
              ) : (
                <button
                  onClick={() =>
                    setActiveCommentGroups(workspaceId, [group.id])
                  }
                  className="flex-1 text-left"
                >
                  <div className="flex flex-col">
                    <span
                      className={cn(
                        "text-sm",
                        activeCommentGroupIds.includes(group.id)
                          ? "text-blue-700 font-medium"
                          : "text-gray-700"
                      )}
                    >
                      {group.name}
                    </span>
                    <span
                      className={cn(
                        "text-xs",
                        activeCommentGroupIds.includes(group.id)
                          ? "text-blue-500"
                          : "text-gray-400"
                      )}
                    >
                      {formatTimestamp(group.createdAt)}
                    </span>
                  </div>
                </button>
              )}

              <div
                className={cn(
                  "flex items-center gap-1 transition-opacity",
                  activeCommentGroupIds.includes(group.id)
                    ? "opacity-100"
                    : "opacity-0 group-hover:opacity-100"
                )}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditingGroupId(group.id);
                    setEditingGroupName(group.name);
                  }}
                  className={cn(
                    "h-6 w-6 p-0",
                    activeCommentGroupIds.includes(group.id)
                      ? "hover:bg-blue-100"
                      : "hover:bg-gray-200"
                  )}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteCommentGroup(group.id)}
                  className={cn(
                    "h-6 w-6 p-0",
                    activeCommentGroupIds.includes(group.id)
                      ? "hover:bg-blue-100"
                      : "hover:bg-gray-200"
                  )}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
