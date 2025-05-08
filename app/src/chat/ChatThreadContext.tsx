import React, { createContext, useContext, useEffect, useState } from "react";
import { chatService } from "./chatService";
import { ReadonlyThread, ThreadComponentData } from "./chat_types";
import {
  sortChatThreads,
  hourMinuteNow,
  getNextNewChatNumber,
  getThreadAhead,
  getThreadBehind,
  getTitleFromMessage,
} from "./chat_util";

interface CreateEmptyThreadOptions {
  includePlaceholderTitle?: boolean;
  setSelected?: boolean;
}

interface ChatThreadContextType {
  currentThreadId: string | null;
  getThread: (threadId: string) => ReadonlyThread;
  getOrderedThreads: () => ReadonlyThread[];
  upgradeEmptyThread: (
    initialChatMessage: string,
    threadId: string
  ) => Promise<void>;
  createEmptyThread: (
    options?: CreateEmptyThreadOptions
  ) => Promise<ReadonlyThread>;
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
  const [threads, setThreads] = useState<{
    [key: string]: ThreadComponentData;
  }>({});

  useEffect(() => {
    const loadThreads = async () => {
      const threads = await chatService.getThreads(workspaceId);
      const threadComponentData: ThreadComponentData[] = threads.map((t) => ({
        apiData: t,
        uiState: {
          isEmpty: false,
        },
      }));
      const threadMap: { [key: string]: ThreadComponentData } = {};
      for (const thread of threadComponentData) {
        threadMap[thread.apiData.id] = thread;
      }
      setThreads(threadMap);
    };
    loadThreads();
  }, [workspaceId]);

  const getReadonlyThreads = (): ReadonlyThread[] => {
    return Object.values(threads).map(toReadonlyThread);
  };

  const updateThreads = (
    update: ThreadComponentData,
    options: {
      expectNew?: boolean;
      expectReplace?: boolean;
    } = {}
  ) => {
    setThreads((prevThreads) => {
      if (options.expectNew) {
        if (prevThreads[update.apiData.id]) {
          throw new Error(`Thread with id ${update.apiData.id} already exists`);
        }
      }
      if (options.expectReplace) {
        if (!prevThreads[update.apiData.id]) {
          throw new Error(`Thread with id ${update.apiData.id} does not exist`);
        }
      }
      return { ...prevThreads, [update.apiData.id]: update };
    });
  };

  const getThread = (threadId: string): ReadonlyThread => {
    const thread = threads[threadId];
    if (!thread) {
      throw new Error(`Thread with id ${threadId} does not exist`);
    }
    return toReadonlyThread(thread);
  };

  const createEmptyThread = async (options?: CreateEmptyThreadOptions) => {
    const threadId = await chatService.createEmptyThread(workspaceId);
    const thread = {
      id: threadId,
      title: "",
      lastMessageAt: hourMinuteNow(),
    };
    if (options?.includePlaceholderTitle) {
      thread.title = `New Chat ${getNextNewChatNumber(getReadonlyThreads())}`;
    }
    const componentThread: ThreadComponentData = {
      apiData: thread,
      uiState: {
        isEmpty: true,
      },
    };
    updateThreads(componentThread);
    if (options?.setSelected) {
      setCurrentThreadId(threadId);
    }
    return toReadonlyThread(componentThread);
  };

  const selectThread = (threadId: string) => {
    if (!threads[threadId]) {
      throw new Error(`Thread with id ${threadId} does not exist`);
    }
    setCurrentThreadId(threadId);
  };

  const deleteThread = async (threadId: string) => {
    if (!threads[threadId]) {
      throw new Error(`Thread with id ${threadId} does not exist`);
    }
    await chatService.deleteThread(threadId, workspaceId);
    const currentThreads = {
      ...threads,
    };
    const readonlyThreads = Object.values(currentThreads).map(toReadonlyThread);
    const threadAheadId = getThreadAhead(readonlyThreads, threadId);
    const threadBehindId = getThreadBehind(readonlyThreads, threadId);
    delete currentThreads[threadId];
    setThreads(currentThreads);
    if (threadAheadId) {
      selectThread(threadAheadId);
      return;
    }
    if (threadBehindId) {
      selectThread(threadBehindId);
      return;
    }
    // There must always be a currentThreadId, so we create a new empty thread,
    // which get's set as the selected thread
    createEmptyThread({
      includePlaceholderTitle: false,
      setSelected: true,
    });
  };

  const renameThread = async (threadId: string, newTitle: string) => {
    await chatService.renameThread(threadId, newTitle, workspaceId);
  };

  const upgradeEmptyThread = async (
    initialChatMessage: string,
    threadId: string
  ) => {
    const thread = threads[threadId];
    if (!thread.uiState.isEmpty) {
      throw new Error("Thread is not empty");
    }
    const updatedThread = await chatService.startThread(
      workspaceId,
      threadId,
      getTitleFromMessage(initialChatMessage)
    );
    updateThreads({
      apiData: updatedThread,
      uiState: {
        isEmpty: false,
      },
    });
  };

  const getOrderedThreads = (): ReadonlyThread[] => {
    const threadOrdering: string[] = sortChatThreads(getReadonlyThreads()).map(
      (t) => t.id
    );
    return threadOrdering.map((id) => toReadonlyThread(threads[id]));
  };

  const value = {
    currentThreadId,
    getOrderedThreads,
    getThread,
    upgradeEmptyThread,
    createEmptyThread,
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

function toReadonlyThread(thread: ThreadComponentData): ReadonlyThread {
  return {
    ...thread.apiData,
    ...thread.uiState,
  };
}
