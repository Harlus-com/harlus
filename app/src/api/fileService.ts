import { Workspace, WorkspaceFile, WorkspaceFolder } from "./workspace_types";
import { client } from "./client";
import { ClaimComment } from "./comment_types";
import { Buffer } from 'buffer';

const filesBeingUploaded = new Set<string>();

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

  async getServerFiles(workspaceId: string): Promise<WorkspaceFile[]> {
    return client.get(`/file/all?workspaceId=${workspaceId}`);
  }

  uploadFile(workspaceId: string, localFile: LocalFile): Promise<void> {
    if (filesBeingUploaded.has(localFile.contentHash)) {
      return;
    }
    filesBeingUploaded.add(localFile.contentHash);
    try {
      return client.upload(localFile, workspaceId);
    } finally {
      filesBeingUploaded.delete(localFile.contentHash);
    }
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

  updateServerDirectories(workspaceId: string, files: LocalFile[]) {
    return client.post(`/update_server_directories`, {
      workspaceId,
      files,
    });
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

  async refreshOnlineData(
    workspace: Workspace, 
    relativeDestinationPath: string | "", 
    startDate: string
  ): Promise<void> {
    console.log(
      `[FileService] Refreshing online data for workspace: ${workspace.name} into ${relativeDestinationPath === "" ? 'workspace root' : relativeDestinationPath}`
    );
    if (!window.electron) {
      throw new Error("Electron is not available");
    }
  
    const filesToDownload = await client.get(
      `/workspace/get_online_data?workspaceTicker=${workspace.name}&startDate=${startDate}`
    );
    
    const creationPromises = filesToDownload.map(async (fileToDownload) => {
      await window.electron.createFile(
        workspace.localDir,
        relativeDestinationPath,
        fileToDownload.fileName,
        Buffer.from(fileToDownload.contentBase64, "base64")
      );
    });
  
    await Promise.all(creationPromises);
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
