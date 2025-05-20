import { Workspace, WorkspaceFile } from "./workspace_types";
import { client } from "./client";

class WorkspaceService {
  constructor() {}

  getWorkspaces(): Promise<Workspace[]> {
    return client.get("/workspace/all");
  }

  async createWorkspace(name: string, files: FileStats[]): Promise<Workspace> {
    const workspace = await client.post("/workspace/create", {
      name,
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
    callbacks: {
      onFileChange?: (file: WorkspaceFile) => void;
      onStructureChange?: () => void;
    }
  ): void {
    if (!window.electron) {
      return;
    }
    window.electron.watchWorkspace(workspace.localDir);
    window.electron.onLocalFileSystemChange((event) => {
      console.log("WS-SERVICE onLocalFileSystemChange", event);
      switch (event.type) {
        case "workspace-file-change":
          callbacks.onFileChange?.(event.file);
          break;
        case "workspace-structure-change":
          callbacks.onStructureChange?.();
          break;
      }
    });
  }

  unwatchWorkspace(workspace: Workspace): void {
    if (!window.electron) {
      return;
    }
    window.electron.unwatchWorkspace(workspace.localDir);
  }
}

export const workspaceService = new WorkspaceService();
