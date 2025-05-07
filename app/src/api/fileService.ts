// Service to handle file operations and communication with the backend API
import { WorkspaceFile } from "./workspace_types";
import { ChatMessage } from "../chat/chat_types";
import { client } from "./client";
import { ClaimComment } from "./comment_types";
// Mock API service for now - will be replaced with actual API calls
class FileService {
  private chatHistory: ChatMessage[] = [];

  // Add files to the workspace
  addFiles(filePaths: string[], workspaceId: string): Promise<WorkspaceFile[]> {
    return Promise.all(
      filePaths.map((path) => client.post("/file/load", { path, workspaceId }))
    );
  }

  importFile(filePath: string, workspaceId: string): Promise<WorkspaceFile> {
    return client.post("/file/load", { path: filePath, workspaceId });
  }

  importFolder(
    folderPath: string,
    workspaceId: string
  ): Promise<WorkspaceFile[]> {
    return client.post("/folder/load", { path: folderPath, workspaceId });
  }

  // Get all files in the workspace
  async getFiles(workspaceId?: string): Promise<WorkspaceFile[]> {
    const files = await client.get(`/workspace/files/${workspaceId}`);
    const statuses = await Promise.all(
      files.map((file) => client.get(`/file/get/status/${file.id}`))
    );
    return files.map((file, index) => ({
      ...file,
      status: statuses[index],
    }));
  }

  deleteFile(file: WorkspaceFile): Promise<boolean> {
    return client.delete(
      `/file/delete/${file.id}?workspace_id=${file.workspaceId}`
    );
  }

  getFileData(file: WorkspaceFile): Promise<ArrayBuffer> {
    return client.getBuffer(
      `/file/handle/${file.id}?workspace_id=${file.workspaceId}`
    );
  }

  // Send a message to the AI assistant
  async sendMessage(content: string): Promise<ChatMessage> {
    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      sender: "user",
      content,
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      chatSourceCommentGroups: [],
    };

    this.chatHistory.push(userMessage);

    // Mock AI response - would be replaced with actual API call
    // For demo, we have some predefined responses
    let responseContent = `I'm analyzing your question: "${content}"`;

    if (content.toLowerCase().includes("financial")) {
      responseContent =
        "The financial reports show a 5% increase in revenue compared to the previous quarter, with significant growth in the technology sector.";
    } else if (content.toLowerCase().includes("market")) {
      responseContent =
        "Market analysis indicates a potential shift towards sustainable investments, with ESG-focused companies outperforming the broader market by 2.3% in Q1.";
    } else if (content.toLowerCase().includes("competitor")) {
      responseContent =
        "Competitor earnings reports reveal a slowdown in their core business segments, with a 3% decline in retail operations but 7% growth in digital services.";
    }

    const aiMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      sender: "assistant",
      content: responseContent,
      timestamp: new Date(),
      chatSourceCommentGroups: [],
    };

    this.chatHistory.push(aiMessage);
    return aiMessage;
  }

  // Get chat history
  async getChatHistory(): Promise<ChatMessage[]> {
    return this.chatHistory;
  }

  // Run contrast analysis between two files
  async runContrastAnalysis(
    file1Id: string,
    file2Id: string
  ): Promise<ClaimComment[]> {
    const params = new URLSearchParams({
      oldFileId: file1Id,
      newFileId: file2Id,
    });
    const comments = await client.get(`/contrast/analyze?${params.toString()}`);
    console.log("[FileService] Comments:", comments);
    return comments;
  }

  async getFileFromId(fileId: string): Promise<WorkspaceFile> {
    const file = await client.get(`/file/get/${fileId}`);
    return file;
  }

  // Get file ID from path
  async getFileFromPath(filePath: string): Promise<WorkspaceFile> {
    const params = new URLSearchParams({
      file_path: filePath,
    });
    console.log("[FileService] Getting file from path:", params.toString());
    const file = await client.get(`/file/get_from_path?${params.toString()}`);
    console.log("[FileService] File:", file);
    /* Convert backend file to WorkspaceFile type
    const workspaceFile: WorkspaceFile = {
      id: file.Id,
      name: file.name,
      absolutePath: file.absolute_path,
      workspaceId: file.workspace_id,
      appDir: file.app_dir,
      status: file.status,
      annotations: file.annotations
        ? {
            show: false,
            data: file.annotations,
          }
        : undefined,
    };
    */
    return file;
  }

  forceSyncFile(file: WorkspaceFile): Promise<boolean> {
    return client.post(`/file/force_sync`, { fileId: file.id });
  }
}

export const fileService = new FileService();
