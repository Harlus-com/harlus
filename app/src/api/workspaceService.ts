import { Workspace, WorkspaceFile } from "./workspace_types";
import { client } from "./client";
import { fileService } from "./fileService";
import { noLocalFileChanges } from "@/files/file_util";
import { noLocalFolderChanges } from "@/files/file_util";

interface LocalFileSystemChange {
  localFolders: LocalFolder[];
  localFiles: LocalFile[];
}

interface LocalFileSystemChangeCallbacks {
  onFileChange?: (file: WorkspaceFile) => void;
  onStructureChange?: (change: LocalFileSystemChange) => void;
}

class WorkspaceService {
  private lastLocalFolders: LocalFolder[] = [];
  private lastLocalFiles: LocalFile[] = [];
  constructor() {}

  getWorkspaces(): Promise<Workspace[]> {
    return client.get("/workspace/all");
  }

  async createWorkspace(name: string, localDir: string): Promise<Workspace> {
    const workspace = await client.post("/workspace/create", {
      name,
      localDir,
    });
    return workspace;
  }

  async getWorkspace(id: string): Promise<Workspace> {
    console.log("Getting workspace", id);
    const workspace = await client.get(`/workspace/get?workspaceId=${id}`);
    return workspace;
  }

  deleteWorkspace(id: string): Promise<void> {
    return client.delete(`/workspace/delete?workspaceId=${id}`);
  }

  watchWorkspace(
    workspace: Workspace,
    callbacks: LocalFileSystemChangeCallbacks
  ): void {
    if (!window.electron) {
      return;
    }
    window.electron.watchWorkspace(workspace.localDir);
    window.electron.onLocalFileSystemChange((event) =>
      this.handleOnLocalFileSystemChange(workspace, event, callbacks)
    );
  }

  private async handleOnLocalFileSystemChange(
    workspace: Workspace,
    event: any,
    callbacks: LocalFileSystemChangeCallbacks
  ): Promise<void> {
    switch (event.type) {
      case "workspace-file-change":
        callbacks.onFileChange?.(event.file);
        break;
      case "workspace-structure-change":
        const localFolders = await fileService.getLocalFolders(workspace);
        const localFiles = await fileService.getLocalFiles(workspace);
        if (
          noLocalFolderChanges(localFolders, this.lastLocalFolders) &&
          noLocalFileChanges(localFiles, this.lastLocalFiles)
        ) {
          return;
        }
        this.lastLocalFolders = localFolders;
        this.lastLocalFiles = localFiles;
        callbacks.onStructureChange?.({
          localFolders,
          localFiles,
        });
        break;
    }
  }

  unwatchWorkspace(workspace: Workspace): void {
    if (!window.electron) {
      return;
    }
    window.electron.unwatchWorkspace(workspace.localDir);
  }
}

export const workspaceService = new WorkspaceService();
