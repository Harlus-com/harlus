import React, { useState, useCallback } from "react";
import { BookOpen, ChevronDown, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { chatService } from "./chatService";
import { Thread } from "./chat_types";

interface ChatHistoryProps {
  workspaceId: string;
  currentThreadId: string | null;
  onThreadSelect: (threadId: string) => void;
  onThreadCreate: (threadId: string) => void;
  onThreadDelete: (threadId: string) => void;
}

export const ChatHistory: React.FC<ChatHistoryProps> = ({
  workspaceId,
  currentThreadId,
  onThreadSelect,
  onThreadCreate,
  onThreadDelete,
}) => {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editingThreadTitle, setEditingThreadTitle] = useState("");

  // Load threads for the workspace
  const loadThreads = useCallback(async () => {
    const threads = await chatService.getThreads(workspaceId);
    setThreads(threads);
  }, [currentThreadId]);

  // Create a new thread
  const createNewThread = useCallback(async () => {
    try {
      const newThreadId = await chatService.startThread(workspaceId!);
      const newThread = {
        id: newThreadId,
        title: `New Chat ${newThreadId.slice(0, 8)}`,
        lastMessageAt: now(),
      };

      setThreads((prev) => [newThread, ...prev]);
      onThreadCreate(newThreadId);
    } catch (error) {
      console.error("Error creating new thread:", error);
    }
  }, [workspaceId, onThreadCreate]);

  const deleteThread = useCallback(
    async (threadId: string) => {
      try {
        await chatService.deleteThread(threadId, workspaceId!);
        setThreads((prev) => prev.filter((t) => t.id !== threadId));
        onThreadDelete(threadId);
      } catch (error) {
        console.error("Error deleting thread:", error);
      }
    },
    [workspaceId, onThreadDelete]
  );

  const renameThread = useCallback(
    async (threadId: string, newTitle: string) => {
      try {
        await chatService.renameThread(threadId, newTitle, workspaceId!);
        setThreads((prev) =>
          prev.map((t) => (t.id === threadId ? { ...t, title: newTitle } : t))
        );
        setEditingThreadId(null);
        setEditingThreadTitle("");
      } catch (error) {
        console.error("Error renaming thread:", error);
      }
    },
    [workspaceId]
  );

  React.useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  return (
    <div className="border-b border-gray-100">
      <div className="px-3.5 py-2 space-y-1">
        {threads.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-gray-500">Start a new chat to begin</p>
          </div>
        ) : (
          threads.map((thread) => (
            <div
              key={thread.id}
              className={cn(
                "group flex items-center justify-between p-2 rounded-md hover:bg-gray-50 transition-colors",
                currentThreadId === thread.id
                  ? "bg-blue-50 border border-blue-200"
                  : ""
              )}
            >
              {editingThreadId === thread.id ? (
                <input
                  type="text"
                  value={editingThreadTitle}
                  onChange={(e) => setEditingThreadTitle(e.target.value)}
                  onBlur={() => {
                    if (editingThreadTitle.trim()) {
                      renameThread(thread.id, editingThreadTitle.trim());
                    } else {
                      setEditingThreadId(null);
                      setEditingThreadTitle("");
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && editingThreadTitle.trim()) {
                      renameThread(thread.id, editingThreadTitle.trim());
                    } else if (e.key === "Escape") {
                      setEditingThreadId(null);
                      setEditingThreadTitle("");
                    }
                  }}
                  className={cn(
                    "flex-1 text-sm bg-transparent border-none focus:ring-0",
                    currentThreadId === thread.id
                      ? "text-blue-700"
                      : "text-gray-700"
                  )}
                  autoFocus
                />
              ) : (
                <button
                  onClick={() => onThreadSelect(thread.id)}
                  className="flex-1 text-left"
                >
                  <div className="flex flex-col">
                    <span
                      className={cn(
                        "text-sm",
                        currentThreadId === thread.id
                          ? "text-blue-700 font-medium"
                          : "text-gray-700"
                      )}
                    >
                      {thread.title}
                    </span>
                    <span
                      className={cn(
                        "text-xs",
                        currentThreadId === thread.id
                          ? "text-blue-500"
                          : "text-gray-400"
                      )}
                    >
                      {/* TODO: Group by yesterday, today, and last 7 days */}
                      {thread.lastMessageAt}
                    </span>
                  </div>
                </button>
              )}

              <div
                className={cn(
                  "flex items-center gap-1 transition-opacity",
                  currentThreadId === thread.id
                    ? "opacity-100"
                    : "opacity-0 group-hover:opacity-100"
                )}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditingThreadId(thread.id);
                    setEditingThreadTitle(thread.title);
                  }}
                  className={cn(
                    "h-6 w-6 p-0",
                    currentThreadId === thread.id
                      ? "hover:bg-blue-100"
                      : "hover:bg-gray-200"
                  )}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteThread(thread.id)}
                  className={cn(
                    "h-6 w-6 p-0",
                    currentThreadId === thread.id
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

        <Button
          variant="ghost"
          size="sm"
          onClick={createNewThread}
          className="w-full mt-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50"
        >
          <Plus className="h-4 w-4 mr-1" />
          New chat
        </Button>
      </div>
    </div>
  );
};

function now(): string {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}
