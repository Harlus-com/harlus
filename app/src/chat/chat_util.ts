import { Thread } from "./chat_types";

export function sortChatThreads(threads: Thread[]): Thread[] {
  return threads.sort((a, b) => {
    const timeCompare = b.lastMessageAt.localeCompare(a.lastMessageAt);
    if (timeCompare !== 0) {
      return timeCompare;
    }
    return b.title.localeCompare(a.title);
  });
}
