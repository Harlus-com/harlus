import React, { createContext, useContext, useEffect, useState } from "react";
import { chatService } from "./chatService";
import {
  ReadonlyThread,
  ThreadComponentData,
  ThreadSavedState,
} from "./chat_types";
import {
  sortChatThreads,
  getThreadAhead,
  getThreadBehind,
  getNextNewChatNumber,
  createNewEmptyThread,
  savedStateRank,
} from "./chat_util";

interface CreateEmptyThreadOptions {
  includePlaceholderTitle?: boolean;
  setSelected?: boolean;
}

interface ChatThreadContextType {
  currentThreadId: string | null;
  getThread: (threadId: string) => ReadonlyThread;
  getOrderedThreads: () => ReadonlyThread[];
  createEmptyThread: (options?: CreateEmptyThreadOptions) => ReadonlyThread;
  selectThread: (threadId: string) => void;
  deleteThread: (threadId: string) => Promise<void>;
  upgradeThreadSavedState: (
    threadId: string,
    newSavedState: ThreadSavedState
  ) => void;
  renameThread: (
    threadId: string,
    newTitle: string,
    options?: { newSavedState?: ThreadSavedState }
  ) => Promise<void>;
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
            savedState:
              messages.length === 0
                ? ThreadSavedState.SAVED_NO_MESSAGES
                : ThreadSavedState.SAVED_WITH_MESSAGES,
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
    if (
      threads[currentThreadId].uiState.savedState !== ThreadSavedState.UI_ONLY
    ) {
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

  const renameThread = async (
    threadId: string,
    newTitle: string,
    options?: { newSavedState?: ThreadSavedState }
  ) => {
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
    const savedState = options?.newSavedState ?? oldThread.uiState.savedState;
    updateThreads(
      {
        apiData: updatedThread,
        uiState: {
          savedState: savedState,
        },
      },
      { expectReplace: true }
    );
  };

  const upgradeThreadSavedState = (
    threadId: string,
    newSavedState: ThreadSavedState
  ) => {
    const thread = threads[threadId];
    if (!thread) {
      throw new Error(`Thread with id ${threadId} does not exist`);
    }
    const oldSavedState = thread.uiState.savedState;
    if (savedStateRank(oldSavedState) > savedStateRank(newSavedState)) {
      throw new Error(`${newSavedState} is a downgrade from ${oldSavedState}`);
    }
    updateThreads(
      { ...thread, uiState: { savedState: newSavedState } },
      { expectReplace: true }
    );
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
    createEmptyThread,
    selectThread,
    deleteThread,
    renameThread,
    upgradeThreadSavedState,
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
