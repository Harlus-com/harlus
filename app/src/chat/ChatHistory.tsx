import React, { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useChatThread } from "./ChatThreadContext";

interface ChatHistoryProps {
  workspaceId: string;
}

export const ChatHistory: React.FC<ChatHistoryProps> = ({ workspaceId }) => {
  const {
    currentThreadId,
    getOrderedThreads,
    createEmptyThread,
    selectThread,
    deleteThread,
    renameThread,
  } = useChatThread();
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editingThreadTitle, setEditingThreadTitle] = useState("");

  const threads = getOrderedThreads();

  return (
    <div className="border-b border-gray-100">
      <div className="px-3.5 py-2 space-y-1">
        {threads.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-gray-500">Start a new chat to begin</p>
          </div>
        ) : (
          threads.map((thread) => {
            const isEmpty = thread.isEmpty;
            if (isEmpty && !thread.title) {
              return null;
            }
            return (
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
                        setEditingThreadId(null);
                        setEditingThreadTitle("");
                      } else {
                        setEditingThreadId(null);
                        setEditingThreadTitle("");
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && editingThreadTitle.trim()) {
                        renameThread(thread.id, editingThreadTitle.trim());
                        setEditingThreadId(null);
                        setEditingThreadTitle("");
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
                    onClick={() => selectThread(thread.id)}
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
                        {isEmpty && (
                          <span className="text-gray-400 ml-1">(empty)</span>
                        )}
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
            );
          })
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            createEmptyThread({
              includePlaceholderTitle: true,
              setSelected: true,
            })
          }
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
