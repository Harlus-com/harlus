// Service to handle file operations and communication with the backend API
import { WorkspaceFile, WorkspaceFolder } from "./workspace_types";
import { ChatMessage } from "../chat/chat_types";
import { client } from "./client";
import { ClaimComment } from "./comment_types";
import { mockFiles, mockFolders } from "./mock_data";

const isDevelopment = true;

// Mock API service for now - will be replaced with actual API calls
class FileService {
  addFiles(filePaths: string[], workspaceId: string): Promise<WorkspaceFile[]> {
    if (isDevelopment) {
      return Promise.resolve(mockFiles);
    }
    return Promise.all(
      filePaths.map((path) => client.post("/file/load", { path, workspaceId }))
    );
  }

  async getFiles(workspaceId?: string): Promise<WorkspaceFile[]> {
    if (isDevelopment) {
      return Promise.resolve(mockFiles);
    }
    return client.get(`/workspace/files?workspaceId=${workspaceId}`);
  }

  deleteFile(file: WorkspaceFile): Promise<boolean> {
    if (isDevelopment) {
      return Promise.resolve(true);
    }
    return client.delete(
      `/file/delete?fileId=${file.id}&workspaceId=${file.workspaceId}`
    );
  }

  getFileData(file: WorkspaceFile): Promise<ArrayBuffer> {
    if (isDevelopment) {
      return Promise.resolve(new ArrayBuffer(0));
    }
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
    if (isDevelopment) {
      return Promise.resolve([]);
    }
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
    if (isDevelopment) {
      const file = mockFiles.find((f) => f.id === fileId);
      if (!file) throw new Error(`File with id ${fileId} not found`);
      return Promise.resolve(file);
    }
    const params = new URLSearchParams({
      fileId: fileId,
    });
    const file = await client.get(`/file/get?${params.toString()}`);
    return file;
  }

  async getFileFromPath(filePath: string): Promise<WorkspaceFile> {
    if (isDevelopment) {
      const file = mockFiles.find((f) => f.absolutePath === filePath);
      if (!file) throw new Error(`File with path ${filePath} not found`);
      return Promise.resolve(file);
    }
    const params = new URLSearchParams({
      filePath: filePath,
    });
    const file = await client.get(`/file/get?${params.toString()}`);
    return file;
  }

  forceSyncFile(file: WorkspaceFile): Promise<boolean> {
    if (isDevelopment) {
      return Promise.resolve(true);
    }
    return client.post(`/file/force_sync`, { fileId: file.id });
  }

  async getFolders(workspaceId: string): Promise<WorkspaceFolder[]> {
    if (isDevelopment) {
      return Promise.resolve(mockFolders);
    }
    return client.get(`/workspace/folders?workspaceId=${workspaceId}`);
  }
}

export const fileService = new FileService();
