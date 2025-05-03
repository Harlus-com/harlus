import { ChatMessage } from "./types";
import { BASE_URL } from "./client";
import { fileService } from "./fileService";

type MessageCallback = (content: string) => void;
type SourcesCallback = (sources: any[]) => void;
type CompleteCallback = () => void;
type ErrorCallback = (error: any) => void;

/**
 * ChatService class handles streaming chat interactions with the server.
 * It manages an EventSource connection to receive real-time updates.
 */
export class ChatService {
  private eventSource: EventSource | null = null;

  
  async streamChat(
    query: string,
    workspaceId: string,
    onMessage: MessageCallback,
    onSources: SourcesCallback,
    onComplete: CompleteCallback,
    onError: ErrorCallback
  ) {

    // Close any existing event source connection
    if (this.eventSource) {
      this.eventSource.close();
    }

    try {

      // 1. create the event source
      const encodedQuery = encodeURIComponent(query);
      const url = `${BASE_URL}/chat/stream?workspaceId=${workspaceId}&query=${encodedQuery}`;
      this.eventSource = new EventSource(url);

      // 2. listen for incoming chat messages
      this.eventSource.addEventListener("message", (event) => {
        const newContent = JSON.parse(event.data).text;
        onMessage(newContent);
      });

      // 3. listen for source information
      this.eventSource.addEventListener("sources", async (event) => {
        console.log("[ChatService] Raw sources event data:", event.data);
        const sources = JSON.parse(event.data);
        console.log("[ChatService] Parsed sources:", sources);

        // get file data for each source
        try {
          console.log("[ChatService] Fetching workspace files for sources...");
          const updatedSources = await Promise.all(
            sources.map(async (source) => {
              console.log("[ChatService] Fetching file for path:", source.file_path);
              const workspaceFile = await fileService.getFileFromPath(source.file_path);
              console.log("[ChatService] Retrieved workspace file:", workspaceFile);
              return {
                ...source,
                workspace_file: workspaceFile,
              };
            })
          );
          console.log("[ChatService] Final updated sources with workspace files:", updatedSources);
          onSources(updatedSources);
        } catch (error) {
          console.error("[ChatService] Error fetching workspace files:", error);
        }
      });

      // 4. listen for the completion of the chat stream
      this.eventSource.addEventListener("complete", () => {
        this.eventSource?.close();
        this.eventSource = null;
        onComplete();
      });

      // 5. andle errors in the event source
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