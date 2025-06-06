import React, { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useComments } from "./useComments";
import { formatTimestamp } from "@/api/api_util";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CommentHistoryProps {
  fileId: string;
}

export const CommentHistory: React.FC<CommentHistoryProps> = ({ fileId }) => {
  const {
    getAllCommentGroups,
    getActiveCommentGroups,
    setActiveCommentGroups,
    setSelectedComment,
    deleteCommentGroup,
    renameCommentGroup,
  } = useComments();
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState("");
  const commentGroups = getAllCommentGroups();
  const activeCommentGroups = getActiveCommentGroups();
  const activeCommentGroupIds = activeCommentGroups.map((group) => group.id);
  console.log("Comment history", commentGroups, activeCommentGroups);

  const handleSelectAll = () => {
    setActiveCommentGroups(commentGroups.map((group) => group.id));
    setSelectedComment(null);
  };

  const handleDeselectAll = () => {
    setActiveCommentGroups([]);
    setSelectedComment(null);
  };

  return (
    <div className="h-full border-b border-gray-100">
      <div className="px-3.5 py-2 border-b border-gray-100 bg-white">
        <div className="flex items-center justify-end">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSelectAll}
              className="h-7 px-2 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            >
              Select All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDeselectAll}
              className="h-7 px-2 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            >
              Deselect All
            </Button>
          </div>
        </div>
      </div>
      <ScrollArea className="h-full">
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
                    onClick={() => {
                      const isActive = activeCommentGroupIds.includes(group.id);
                      setActiveCommentGroups(
                        isActive
                          ? activeCommentGroupIds.filter(
                              (id) => id !== group.id
                            )
                          : [...activeCommentGroupIds, group.id]
                      );
                      setSelectedComment(null);
                    }}
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
      </ScrollArea>
    </div>
  );
};
