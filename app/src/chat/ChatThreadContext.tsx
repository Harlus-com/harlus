import React, { createContext, useContext, useEffect, useState } from "react";
import { chatService } from "./chatService";
import { ReadonlyThread, ThreadComponentData } from "./chat_types";
import {
  sortChatThreads,
  getThreadAhead,
  getThreadBehind,
  getTitleFromMessage,
  getNextNewChatNumber,
  createNewEmptyThread,
} from "./chat_util";

interface CreateEmptyThreadOptions {
  includePlaceholderTitle?: boolean;
  setSelected?: boolean;
}

interface ChatThreadContextType {
  currentThreadId: string | null;
  getThread: (threadId: string) => ReadonlyThread;
  getOrderedThreads: () => ReadonlyThread[];
  persistUiOnlyThread: (
    initialChatMessage: string,
    threadId: string
  ) => Promise<void>;
  createEmptyThread: (options?: CreateEmptyThreadOptions) => ReadonlyThread;
  selectThread: (threadId: string) => void;
  deleteThread: (threadId: string) => Promise<void>;
  renameThread: (threadId: string, newTitle: string) => Promise<void>;
  markThreadAsNonEmpty: (threadId: string) => void;
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
  const emptyThread = createNewEmptyThread();
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(
    emptyThread.apiData.id
  );
  const [threads, setThreads] = useState<{
    [key: string]: ThreadComponentData;
  }>({
    [emptyThread.apiData.id]: emptyThread,
  });

  useEffect(() => {
    const loadThreads = async () => {
      const threads = await chatService.getThreads(workspaceId);
      const threadComponentData: ThreadComponentData[] = [];
      for (const thread of threads) {
        const messages = await chatService.getChatHistory(
          thread.id,
          workspaceId
        );
        threadComponentData.push({
          apiData: thread,
          uiState: {
            isEmpty: messages.length === 0,
            isUiOnly: false,
          },
        });
      }
      const threadMap: { [key: string]: ThreadComponentData } = {};
      for (const thread of threadComponentData) {
        threadMap[thread.apiData.id] = thread;
      }
      setThreads((prev) => ({ ...prev, ...threadMap }));
    };
    loadThreads();
  }, [workspaceId]);

  useEffect(() => {
    if (!threads[currentThreadId].uiState.isEmpty) {
      chatService.setThread(currentThreadId, workspaceId);
    }
  }, [currentThreadId]);

  const getReadonlyThreads = (): ReadonlyThread[] => {
    return Object.values(threads).map(toReadonlyThread);
  };

  const updateThreads = (
    update: ThreadComponentData,
    options: {
      expectNew?: boolean;
      expectReplace?: boolean;
    }
  ) => {
    if (options.expectNew && options.expectReplace) {
      throw new Error("expectNew and expectReplace cannot both be true");
    }
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
    console.log("getThread", threadId);
    console.log("getThread", threads);
    const thread = threads[threadId];
    if (!thread) {
      throw new Error(`Thread with id ${threadId} does not exist`);
    }
    return toReadonlyThread(thread);
  };

  const createEmptyThread = (options?: CreateEmptyThreadOptions) => {
    const title =
      options?.includePlaceholderTitle == true
        ? `New Chat ${getNextNewChatNumber(getReadonlyThreads())}`
        : "";
    const componentThread = createNewEmptyThread(title);
    updateThreads(componentThread, { expectNew: true });
    if (options?.setSelected) {
      setCurrentThreadId(componentThread.apiData.id);
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
    const oldThread = threads[threadId];
    if (!oldThread) {
      throw new Error(`Thread with id ${threadId} does not exist`);
    }
    const updatedThread = await chatService.upsertThread(
      workspaceId,
      threadId,
      newTitle,
      {
        setAsActiveThreadServerSide: threadId === currentThreadId,
      }
    );
    const messages = await chatService.getChatHistory(threadId, workspaceId);
    updateThreads(
      {
        apiData: updatedThread,
        uiState: {
          isEmpty: messages.length === 0,
          isUiOnly: false,
        },
      },
      { expectReplace: true }
    );
  };

  const persistUiOnlyThread = async (
    initialChatMessage: string,
    threadId: string
  ) => {
    const thread = threads[threadId];
    if (!thread.uiState.isUiOnly) {
      throw new Error("Thread is not ui only");
    }
    const updatedThread = await chatService.upsertThread(
      workspaceId,
      threadId,
      getTitleFromMessage(initialChatMessage),
      {
        setAsActiveThreadServerSide: threadId === currentThreadId,
      }
    );
    updateThreads(
      {
        apiData: updatedThread,
        uiState: {
          isEmpty: false,
          isUiOnly: false,
        },
      },
      { expectReplace: true }
    );
  };

  const getOrderedThreads = (): ReadonlyThread[] => {
    const threadOrdering: string[] = sortChatThreads(getReadonlyThreads()).map(
      (t) => t.id
    );
    return threadOrdering.map((id) => toReadonlyThread(threads[id]));
  };

  const markThreadAsNonEmpty = (threadId: string) => {
    const thread = threads[threadId];
    if (!thread) {
      throw new Error(`Thread with id ${threadId} does not exist`);
    }
    updateThreads(
      {
        ...thread,
        uiState: {
          ...thread.uiState,
          isEmpty: false,
        },
      },
      { expectReplace: true }
    );
  };

  const value = {
    currentThreadId,
    getOrderedThreads,
    getThread,
    persistUiOnlyThread,
    createEmptyThread,
    selectThread,
    deleteThread,
    renameThread,
    markThreadAsNonEmpty,
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
