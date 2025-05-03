import { ChatMessage, ChatSourceComment, BoundingBox, HighlightArea, ChatSourceCommentGroup } from "./types";
import { BASE_URL } from "./client";
import { fileService } from "./fileService";

// Utility function to convert snake_case to camelCase
function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

// Utility function to convert object keys from snake_case to camelCase
function convertKeysToCamelCase(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(convertKeysToCamelCase);
  }
  
  if (obj !== null && typeof obj === 'object') {
    const newObj: any = {};
    Object.keys(obj).forEach(key => {
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

  async streamChat(
    userQuery: string,
    workspaceId: string,
    onMessage: (content: string) => void,
    onSources: (sources: ChatSourceCommentGroup[]) => void,
    onComplete: () => void,
    onError: (error: any) => void
  ) {
    console.log("[ChatService] Starting chat stream:", {
      userQueryLength: userQuery.length,
      workspaceId
    });

    // Close any existing event source connection
    if (this.eventSource) {
      this.eventSource.close();
    }

    try {
      // 1. create the event source
      const encodedQuery = encodeURIComponent(userQuery);
      const url = `${BASE_URL}/chat/stream?workspaceId=${workspaceId}&query=${encodedQuery}`;
      this.eventSource = new EventSource(url);

      // 2. listen for incoming chat messages
      this.eventSource.addEventListener("message", (event) => {
        const newContent = JSON.parse(event.data).text;
        onMessage(newContent);
      });

      // 3. listen for source information
      this.eventSource.addEventListener("sources", async (event) => {
        try {
          // Parse and convert the raw data from snake_case to camelCase
          const rawData = JSON.parse(event.data);
          console.log("[ChatService] Raw source data:", rawData);
          
          const convertedData = convertKeysToCamelCase(rawData);
          console.log("[ChatService] Converted source data:", convertedData);

          // Parse source comments with converted data
          const chatSourceComments = convertedData.map((item: any) => ({
            id: item.id,
            fileId: item.fileId,
            threadId: item.threadId,
            messageId: item.messageId,
            text: item.text,
            highlightArea: {
              boundingBoxes: item.highlightArea.boundingBoxes.map((bbox: any) => ({
                left: bbox.left,
                top: bbox.top,
                width: bbox.width,
                height: bbox.height,
                page: bbox.page
              })),
              jumpToPageNumber: item.highlightArea.jumpToPageNumber
            },
            nextChatCommentId: item.nextChatCommentId
          })) as ChatSourceComment[];

          console.log("[ChatService] Parsed source comments:", chatSourceComments);

          // Group source comments by file
          const chatSourceCommentGroups: ChatSourceCommentGroup[] = [];
          const fileIdToGroupMap: { [key: string]: ChatSourceCommentGroup } = {};
          
          chatSourceComments.forEach((cscomment) => {
            const fileId = cscomment.fileId;
            if (!fileIdToGroupMap[fileId]) {
              fileIdToGroupMap[fileId] = {
                fileId: fileId,
                chatSourceComments: [],
              };
              chatSourceCommentGroups.push(fileIdToGroupMap[fileId]);
            }
            fileIdToGroupMap[fileId].chatSourceComments.push(cscomment);
          });

          console.log("[ChatService] Grouped source comments by file:", chatSourceCommentGroups);

          // Get workspace files for each source comment
          const updatedChatSourceCommentGroups = await Promise.all(
            chatSourceCommentGroups.map(async (cscommentGroup) => {
              const workspaceFile = await fileService.getFileFromPath(cscommentGroup.fileId);
              return {
                ...cscommentGroup,
                workspace_file: workspaceFile,
              };
            })
          );

          console.log("[ChatService] Final updated sources with workspace files:", updatedChatSourceCommentGroups);
          onSources(updatedChatSourceCommentGroups);
          console.log("[ChatService] Passed sources to parent callback");
        } catch (error) {
          console.error("[ChatService] Error processing sources:", error);
          onError(error);
        }
      });

      // 4. listen for the completion of the chat stream
      this.eventSource.addEventListener("complete", () => {
        this.eventSource?.close();
        this.eventSource = null;
        onComplete();
      });

      // 5. handle errors in the event source
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
}

// Export a singleton instance of ChatService
export const chatService = new ChatService(); 