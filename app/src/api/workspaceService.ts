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
      await client.upload(file.path, workspace.id);
    }

    return workspace;
  }

  async getWorkspace(id: string): Promise<Workspace> {
    console.log("Getting workspace", id);
    const workspace = await client.get(`/workspace/get?workspaceId=${id}`);
    workspace.localDir = "/Users/danielglasgow/Desktop/AMAT";
    return workspace;
  }

  deleteWorkspace(id: string): Promise<void> {
    return client.delete(`/workspace/delete?workspaceId=${id}`);
  }
}

export const workspaceService = new WorkspaceService();
