import { Thread, ThreadComponentData } from "./chat_types";
import { v4 as uuidv4 } from "uuid";

export function sortChatThreads(threads: Thread[]): Thread[] {
  return threads.sort((a, b) => {
    const timeCompare = b.lastMessageAt.localeCompare(a.lastMessageAt);
    if (timeCompare !== 0) {
      return timeCompare;
    }
    return b.title.localeCompare(a.title);
  });
}

export function getNextNewChatNumber(threads: Thread[]): number {
  const newChatPattern = /^New Chat (\d+)$/;
  let maxNumber = 0;

  threads.forEach((thread) => {
    const match = thread.title.match(newChatPattern);
    if (match) {
      const number = parseInt(match[1], 10);
      if (!isNaN(number) && number > maxNumber) {
        maxNumber = number;
      }
    }
  });

  return maxNumber + 1;
}
export function hourMinuteNow(): string {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getThreadAhead(
  threads: Thread[],
  threadId: string
): string | null {
  const sortedThreads = sortChatThreads(threads);
  const index = sortedThreads.findIndex((t) => t.id === threadId);
  if (index === -1) {
    return null;
  }
  return sortedThreads[index + 1]?.id ?? null;
}

export function getThreadBehind(
  threads: Thread[],
  threadId: string
): string | null {
  const sortedThreads = sortChatThreads(threads);
  const index = sortedThreads.findIndex((t) => t.id === threadId);
  if (index === -1) {
    return null;
  }
  return sortedThreads[index - 1]?.id ?? null;
}

export function getTitleFromMessage(message: string): string {
  return (
    message.trim().slice(0, 50) + (message.trim().length > 50 ? "..." : "")
  );
}

export function createNewEmptyThread(title?: string): ThreadComponentData {
  const threadId = uuidv4();
  const thread = {
    id: threadId,
    title: title ?? "",
    lastMessageAt: hourMinuteNow(),
  };
  const componentThread: ThreadComponentData = {
    apiData: thread,
    uiState: {
      isEmpty: true,
      isUiOnly: true,
    },
  };
  return componentThread;
}
