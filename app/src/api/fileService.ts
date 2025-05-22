import { Workspace, WorkspaceFile, WorkspaceFolder } from "./workspace_types";
import { client } from "./client";
import { ClaimComment } from "./comment_types";

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
  async getLocalFolders(workspace: Workspace): Promise<LocalFolder[]> {
    console.log("Getting folders for workspace", workspace.id);
    if (!window.electron) {
      throw new Error("Electron is not available");
    }
    return window.electron.getLocalFolders(workspace.localDir);
  }

  async refreshOnlineData(
    workspace: Workspace,
    pathRelativeToWorkspace: string | "",
    startDate: string
  ): Promise<void> {
    if (!window.electron) {
      throw new Error("Electron is not available");
    }

    const files: { name: string; url: string }[] = await client.get(
      `/workspace/${workspace.name}/online_files?startDate=${startDate}`
    );
    const baseUrl = await window.electron.getBaseUrl();
    const authHeader = await client.getAuthHeader(); // Assumes client has a method to get the current auth header

    for (const { name, url: remoteFileUrlSuffix } of files) {
      try {
        const serverApiDownloadUrl = `${baseUrl}/file/download_pdf_from_url?url=${encodeURIComponent(
          remoteFileUrlSuffix
        )}`;

        const destPath = await window.electron.ensureFile(
          workspace.localDir,
          pathRelativeToWorkspace,
          `${name}.pdf`
        );
        await window.electron.downloadPdfFromUrl(
          serverApiDownloadUrl,
          destPath,
          authHeader
        );

        console.log(
          `[FileService] Successfully downloaded ${name} to ${destPath}`
        );
      } catch (error) {
        console.error(`[FileService] Failed to download ${name}:`, error);
      }
    }
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

  renameFile(
    item: LocalFile,
    newName: string,
    workspace: Workspace
  ): Promise<boolean> {
    if (!window.electron) {
      throw new Error("Electron is not available");
    }
    return window.electron.moveItem(item.absolutePath, [
      ...workspace.localDirParts,
      ...item.pathRelativeToWorkspace,
      newName,
    ]);
  }

  renameFolder(
    item: LocalFolder,
    newName: string,
    workspace: Workspace
  ): Promise<boolean> {
    if (!window.electron) {
      throw new Error("Electron is not available");
    }
    return window.electron.moveItem(item.absolutePath, [
      ...workspace.localDirParts,
      ...item.pathRelativeToWorkspace.slice(0, -1),
      newName,
    ]);
  }

  moveItem(
    item: LocalFile,
    newRelativePath: string[],
    workspace: Workspace
  ): Promise<boolean> {
    if (!window.electron) {
      throw new Error("Electron is not available");
    }
    return window.electron.moveItem(item.absolutePath, [
      ...workspace.localDirParts,
      ...newRelativePath,
      item.name,
    ]);
  }

  moveFolder(
    folder: LocalFolder,
    newRelativePath: string[],
    workspace: Workspace
  ): Promise<boolean> {
    if (!window.electron) {
      throw new Error("Electron is not available");
    }
    const name = [...folder.pathRelativeToWorkspace].pop();
    return window.electron.moveItem(folder.absolutePath, [
      ...workspace.localDirParts,
      ...newRelativePath,
      name,
    ]);
  }
}

export const fileService = new FileService();
