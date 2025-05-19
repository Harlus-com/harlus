// Service to handle file operations and communication with the backend API
import { WorkspaceFile } from "./workspace_types";
import { ChatMessage } from "../chat/chat_types";
import { client } from "./client";
import { ClaimComment } from "./comment_types";
// Mock API service for now - will be replaced with actual API calls
class FileService {
  // Add files to the workspace
  addFiles(filePaths: string[], workspaceId: string): Promise<WorkspaceFile[]> {
    return Promise.all(
      filePaths.map((path) => client.post("/file/load", { path, workspaceId }))
    );
  }

  // Get all files in the workspace
  async getFiles(workspaceId?: string): Promise<WorkspaceFile[]> {
    return client.get(`/workspace/files?workspaceId=${workspaceId}`);
  }

  deleteFile(file: WorkspaceFile): Promise<boolean> {
    return client.delete(
      `/file/delete?fileId=${file.id}&workspaceId=${file.workspaceId}`
    );
  }

  getFileData(file: WorkspaceFile): Promise<ArrayBuffer> {
    return client.getBuffer(
      `/file/handle?fileId=${file.id}&workspaceId=${file.workspaceId}`
    );
  }

  // Run contrast analysis between two files
  async runContrastAnalysis(
    file1Id: string,
    file2Id: string,
    workspaceId?: string
  ): Promise<ClaimComment[]> {
    const params = new URLSearchParams({
      oldFileId: file1Id,
      newFileId: file2Id,
    });
    
    if (workspaceId) {
      params.append("workspaceId", workspaceId);
    }
    
    const comments = await client.get(`/contrast/analyze?${params.toString()}`);
    console.log("[FileService] Comments:", comments);
    return comments;
  }

  async getFileFromId(fileId: string): Promise<WorkspaceFile> {
    const params = new URLSearchParams({
      fileId: fileId,
    });
    const file = await client.get(`/file/get?${params.toString()}`);
    return file;
  }

  async getFileFromPath(filePath: string): Promise<WorkspaceFile> {
    const params = new URLSearchParams({
      filePath: filePath,
    });
    const file = await client.get(`/file/get?${params.toString()}`);
    return file;
  }

  forceSyncFile(file: WorkspaceFile): Promise<boolean> {
    return client.post(`/file/force_sync`, { fileId: file.id });
  }
}

export const fileService = new FileService();
