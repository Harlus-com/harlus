import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { chatService } from "./chatService";
import { Thread } from "./chat_types";

interface ChatThreadContextType {
  currentThreadId: string | null;
  threads: Thread[];
  createThread: (title?: string) => Promise<Thread>;
  selectThread: (threadId: string) => void;
  deleteThread: (threadId: string) => Promise<void>;
  renameThread: (threadId: string, newTitle: string) => Promise<void>;
}

const ChatThreadContext = createContext<ChatThreadContextType | null>(null);

export const useChatThread = () => {
  const context = useContext(ChatThreadContext);
  if (!context) {
    throw new Error("useChatThread must be used within a ChatThreadProvider");
  }
  return context;
};

interface ChatThreadProviderProps {
  workspaceId: string;
  children: React.ReactNode;
}

export const ChatThreadProvider: React.FC<ChatThreadProviderProps> = ({
  workspaceId,
  children,
}) => {
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);

  const loadThreads = useCallback(async () => {
    const loadedThreads = await chatService.getThreads(workspaceId);
    const sortedThreads = loadedThreads.sort((a, b) => {
      const timeCompare = b.lastMessageAt.localeCompare(a.lastMessageAt);
      if (timeCompare !== 0) return timeCompare;
      return b.title.localeCompare(a.title);
    });
    setThreads(sortedThreads);
  }, [workspaceId]);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  const createThread = async (title?: string) => {
    console.log("[ChatThreadContext] Creating thread", { title });
    const nextNumber = await chatService.getNextNewChatNumber(workspaceId);
    const newTitle = title || `New Chat ${nextNumber}`;
    const newThreadId = await chatService.startThread(workspaceId, newTitle);
    await loadThreads();
    setCurrentThreadId(newThreadId);
    const newThread = await chatService.getThread(workspaceId, newThreadId);
    return newThread;
  };

  const selectThread = (threadId: string) => {
    setCurrentThreadId(threadId);
  };

  const deleteThread = async (threadId: string) => {
    await chatService.deleteThread(threadId, workspaceId);
    await loadThreads();
    const nextThread = threads.find((t) => t.id !== threadId);
    if (nextThread) {
      setCurrentThreadId(nextThread.id);
    } else {
      setCurrentThreadId(null);
    }
  };

  const renameThread = async (threadId: string, newTitle: string) => {
    await chatService.renameThread(threadId, newTitle, workspaceId);
    await loadThreads();
  };

  const value = {
    currentThreadId,
    threads,
    createThread,
    selectThread,
    deleteThread,
    renameThread,
  };

  return (
    <ChatThreadContext.Provider value={value}>
      {children}
    </ChatThreadContext.Provider>
  );
};
