import { Workspace } from "./workspace_types";
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
    for (const file of files) {
      await window.electron.upload(file.path, workspace.id);
    }

    return workspace;
  }

  getWorkspace(id: string): Promise<Workspace> {
    return client.get(`/workspace/get?workspaceId=${id}`);
  }

  deleteWorkspace(id: string): Promise<void> {
    return client.delete(`/workspace/delete?workspaceId=${id}`);
  }
}

export const workspaceService = new WorkspaceService();
