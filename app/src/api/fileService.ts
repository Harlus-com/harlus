import { Workspace, WorkspaceFile, WorkspaceFolder } from "./workspace_types";
import { client } from "./client";
import { ClaimComment } from "./comment_types";

class FileService {
  addFiles(filePaths: string[], workspaceId: string): Promise<WorkspaceFile[]> {
    return Promise.all(
      filePaths.map((path) => client.post("/file/load", { path, workspaceId }))
    );
  }

  async getFiles(workspace: Workspace): Promise<WorkspaceFile[]> {
    if (!window.electron) {
      throw new Error("Electron is not available");
    }
    const localFiles = await window.electron.getLocalFiles(workspace.localDir);
    return localFiles.map((localFile) => ({
      id: localFile.contentHash,
      name: localFile.name,
      absolutePath: localFile.absolutePath,
      workspaceId: workspace.id,
      appDir: localFile.pathRelativeToWorkspace,
    }));
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

  async getFolders(workspace: Workspace): Promise<WorkspaceFolder[]> {
    if (!window.electron) {
      throw new Error("Electron is not available");
    }
    const localFolders = await window.electron.getLocalFolders(
      workspace.localDir
    );
    return localFolders.map((localFolder) => ({
      workspaceId: workspace.id,
      appDir: localFolder.pathRelativeToWorkspace,
    }));
  }

  createFolder(
    workspaceId: string,
    appDir: string[]
  ): Promise<WorkspaceFolder> {
    return client.post(`/workspace/create_folder`, {
      workspaceId,
      appDir,
    });
  }

  deleteFolder(workspaceId: string, appDir: string[]): Promise<boolean> {
    return client.post(`/workspace/delete_folder`, {
      workspaceId,
      appDir,
    });
  }

  renameFolder(
    workspaceId: string,
    appDir: string[],
    newName: string
  ): Promise<boolean> {
    return client.post(`/workspace/rename_folder`, {
      workspaceId,
      appDir,
      newName,
    });
  }

  moveFolder(
    workspaceId: string,
    appDir: string[],
    newParentDir: string[]
  ): Promise<boolean> {
    return client.post(`/workspace/move_folder`, {
      workspaceId,
      appDir,
      newParentDir,
    });
  }

  moveFile(
    workspaceId: string,
    fileId: string,
    newParentDir: string[]
  ): Promise<boolean> {
    return client.post(`/workspace/move_file`, {
      workspaceId,
      fileId,
      newParentDir,
    });
  }
}

export const fileService = new FileService();
