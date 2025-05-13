import { BASE_URL, client } from "../api/client";
import { fileService } from "../api/fileService";
import { ChatSourceCommentGroup, MessagePair, Thread } from "./chat_types";
import { ChatSourceComment } from "@/api/comment_types";

// Utility function to convert snake_case to camelCase
function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

// Utility function to convert object keys from snake_case to camelCase
function convertKeysToCamelCase(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(convertKeysToCamelCase);
  }

  if (obj !== null && typeof obj === "object") {
    const newObj: any = {};
    Object.keys(obj).forEach((key) => {
      const camelKey = snakeToCamel(key);
      newObj[camelKey] = convertKeysToCamelCase(obj[key]);
    });
    return newObj;
  }

  return obj;
}

/**
 * ChatService class handles streaming chat interactions with the server.
 * It manages an EventSource connection to receive real-time updates.
 */
export class ChatService {
  private eventSource: EventSource | null = null;
  private debounceTimeout: NodeJS.Timeout | null = null;
  private pendingSaveData: {
    messagePairs: MessagePair[];
    threadId: string;
    workspaceId: string;
  } | null = null;

  async streamChat(
    userQuery: string,
    workspaceId: string,
    threadId: string,
    onMessage: (
      content: string,
      messageType: "reading_message" | "answer_message" | "planning_message"
    ) => void,
    onSources: (sources: ChatSourceCommentGroup[]) => void,
    onComplete: () => void,
    onError: (error: any) => void
  ) {
    console.log("[ChatService] Initializing", {
      userQueryLength: userQuery.length,
      workspaceId,
    });

    // Close any existing event source connection
    if (this.eventSource) {
      this.eventSource.close();
    }

    try {
      // 1. create the event source
      const encodedQuery = encodeURIComponent(userQuery);
      const url = `${BASE_URL}/chat/stream?workspaceId=${workspaceId}&query=${encodedQuery}&threadId=${threadId}`;
      this.eventSource = new EventSource(url);

      // 2. listen for planning messages
      this.eventSource.addEventListener("planning_message", (event) => {
        const newContent = JSON.parse(event.data).text;
        onMessage(newContent, "planning_message");
      });

      // 3. listen for reading messages
      this.eventSource.addEventListener("reading_message", (event) => {
        const newContent = JSON.parse(event.data).text;
        onMessage(newContent, "reading_message");
      });

      // 4. listen for answer messages
      this.eventSource.addEventListener("answer_message", (event) => {
        const newContent = JSON.parse(event.data).text;
        onMessage(newContent, "answer_message");
      });

      // 5. listen for source information
      this.eventSource.addEventListener("sources", async (event) => {
        try {
          // Parse and convert the raw data from snake_case to camelCase
          const rawData = JSON.parse(event.data);
          console.log("[ChatService] Received raw source data:", rawData);

          const convertedData = convertKeysToCamelCase(rawData);

          // Parse source comments with converted data
          const chatSourceComments: ChatSourceComment[] = convertedData.map(
            createChatSourceComment
          );

          console.log(
            "[ChatService] Parsed raw data to source comments:",
            chatSourceComments
          );

          // Group source comments by file
          const chatSourceCommentGroups: ChatSourceCommentGroup[] = [];
          const filePathToGroupMap: { [key: string]: ChatSourceCommentGroup } =
            {};

          chatSourceComments.forEach((cscomment) => {
            const filePath = cscomment.filePath;
            if (!filePathToGroupMap[filePath]) {
              filePathToGroupMap[filePath] = {
                filePath: filePath,
                chatSourceComments: [],
              };
              chatSourceCommentGroups.push(filePathToGroupMap[filePath]);
            }
            filePathToGroupMap[filePath].chatSourceComments.push(cscomment);
          });

          console.log(
            "[ChatService] Grouped source comments by file:",
            chatSourceCommentGroups
          );

          // Get workspace files for each source comment
          const updatedChatSourceCommentGroups = await Promise.all(
            chatSourceCommentGroups.map(async (cscommentGroup) => {
              const workspaceFile = await fileService.getFileFromPath(
                cscommentGroup.filePath
              );
              console.log("checkpoint 1:", workspaceFile);
              return {
                ...cscommentGroup,
                workspace_file: workspaceFile,
              };
            })
          );

          console.log(
            "[ChatService] Updated sources with workspace files:",
            updatedChatSourceCommentGroups
          );
          onSources(updatedChatSourceCommentGroups);
        } catch (error) {
          console.error("[ChatService] Error processing sources:", error);
          onError(error);
        }
      });

      // 6. listen for the completion of the chat stream
      this.eventSource.addEventListener("complete", () => {
        this.eventSource?.close();
        this.eventSource = null;
        onComplete();
      });

      // 7. handle errors in the event source
      this.eventSource.addEventListener("error", (error) => {
        console.error("EventSource error:", error);
        this.eventSource?.close();
        this.eventSource = null;
        onError(error);
      });
    } catch (error) {
      console.error("Error setting up stream:", error);
      onError(error);
    }
  }

  /**
   * Closes the current EventSource connection if it exists.
   */
  close() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  /**
   * Saves chat history for a specific thread with debouncing
   */
  saveChatHistory(
    messagePairs: MessagePair[],
    threadId: string,
    workspaceId: string
  ) {
    this.pendingSaveData = { messagePairs, threadId, workspaceId };
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }
    this.debounceTimeout = setTimeout(() => {
      if (this.pendingSaveData) {
        client.post(
          `/chat/save_history?threadId=${this.pendingSaveData.threadId}&workspaceId=${this.pendingSaveData.workspaceId}`,
          {
            messagePairs: this.pendingSaveData.messagePairs,
          }
        );
        this.pendingSaveData = null;
      }
    }, 1000);
  }

  /** Create or update a chat thread */
  async upsertThread(
    workspaceId: string,
    threadId: string,
    title: string,
    options: {
      setAsActiveThreadServerSide: boolean;
    }
  ): Promise<Thread> {
    console.log("[ChatService] Upserting thread", { workspaceId, title });
    const response = await client.post("/chat/thread/upsert", {
      workspaceId,
      threadId,
      title,
    });
    if (options.setAsActiveThreadServerSide) {
      await client.post("/chat/set_thread", {
        workspaceId,
        threadId,
      });
    }
    return response;
  }

  async getThread(workspaceId: string, threadId: string): Promise<Thread> {
    const response = await client.get(
      `/chat/thread?workspaceId=${workspaceId}&threadId=${threadId}`
    );
    return response;
  }

  async getThreads(workspaceId: string): Promise<Thread[]> {
    const response = await client.get(
      `/chat/threads?workspaceId=${workspaceId}`
    );
    return response.threads;
  }

  async getChatHistory(
    threadId: string,
    workspaceId: string
  ): Promise<MessagePair[]> {
    const response = await client.get(
      `/chat/get_history?threadId=${threadId}&workspaceId=${workspaceId}`
    );
    return response.messagePairs;
  }

  async deleteThread(threadId: string, workspaceId: string): Promise<void> {
    await client.delete(
      `/chat/thread?threadId=${threadId}&workspaceId=${workspaceId}`
    );
  }

  async setThread(threadId: string, workspaceId: string): Promise<void> {
    await client.post("/chat/set_thread", {
      workspaceId,
      threadId,
    });
  }
}

function createChatSourceComment(item: any): ChatSourceComment {
  return {
    id: item.id,
    filePath: item.filePath,
    threadId: item.threadId,
    messageId: item.messageId,
    text: item.text,
    highlightArea: {
      boundingBoxes: item.highlightArea.boundingBoxes.map((bbox: any) => ({
        left: bbox.left,
        top: bbox.top,
        width: bbox.width,
        height: bbox.height,
        page: bbox.page,
      })),
    },
    commentGroupId: item.threadId,
    nextChatCommentId: item.nextChatCommentId,
  };
}

// Export a singleton instance of ChatService
export const chatService = new ChatService();
