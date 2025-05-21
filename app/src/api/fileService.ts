import { Workspace, WorkspaceFile, WorkspaceFolder } from "./workspace_types";
import { client } from "./client";
import { ClaimComment } from "./comment_types";

class FileService {
  addFiles(filePaths: string[], workspaceId: string): Promise<WorkspaceFile[]> {
    return Promise.all(
      filePaths.map((path) => client.post("/file/load", { path, workspaceId }))
    );
  }

  async getLocalFiles(workspace: Workspace): Promise<LocalFile[]> {
    console.log("Getting files for workspace", workspace.id);
    if (!window.electron) {
      throw new Error("Electron is not available");
    }
    return window.electron.getLocalFiles(workspace.localDir);
  }

  deleteLocalFile(file: LocalFile): Promise<boolean> {
    if (!window.electron) {
      throw new Error("Electron is not available");
    }
    return window.electron.deleteItem(file);
  }

  deleteFile(file: WorkspaceFile): Promise<boolean> {
    return client.delete(
      `/file/delete?fileId=${file.id}&workspaceId=${file.workspaceId}`
    );
  }

  readFileFromLocalFileSystem(file: LocalFile): Promise<ArrayBuffer> {
    if (!window.electron) {
      throw new Error("Electron is not available");
    }
    return window.electron.getFileContent(file.absolutePath);
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

  // TODO: We should really get rid of this function and make sure the server only ever returns contentHash
  async getFileFromServer(args: {
    serverFilePath: string;
  }): Promise<WorkspaceFile> {
    const params = new URLSearchParams({
      filePath: args.serverFilePath,
    });
    const file = await client.get(`/file/get?${params.toString()}`);
    return file;
  }

  async getLocalFolders(workspace: Workspace): Promise<LocalFolder[]> {
    console.log("Getting folders for workspace", workspace.id);
    if (!window.electron) {
      throw new Error("Electron is not available");
    }
    return window.electron.getLocalFolders(workspace.localDir);
  }

  createFolder(
    parentFolder: LocalFolder,
    newFolderName: string
  ): Promise<boolean> {
    if (!window.electron) {
      throw new Error("Electron is not available");
    }
    return window.electron.createFolder(parentFolder, newFolderName);
  }

  deleteFolder(folder: LocalFolder): Promise<boolean> {
    if (!window.electron) {
      throw new Error("Electron is not available");
    }
    return window.electron.deleteItem(folder);
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

  moveItem(
    item: LocalFile | LocalFolder,
    newRelativePath: string[]
  ): Promise<boolean> {
    if (!window.electron) {
      throw new Error("Electron is not available");
    }
    return window.electron.moveItem(item, newRelativePath);
  }
}

export const fileService = new FileService();
