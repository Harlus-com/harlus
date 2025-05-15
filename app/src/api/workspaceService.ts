import { Workspace } from "./workspace_types";
import { client } from "./client";

class WorkspaceService {
  constructor() {}

  getWorkspaces(): Promise<Workspace[]> {
    return client.get("/workspace/all");
  }

  createWorkspace(name: string, files: FileStats[]): Promise<Workspace> {
    return client.post("/workspace/create", {
      name,
      initialFilePaths: files.map((file) => file.path),
    });
  }

  getWorkspace(id: string): Promise<Workspace> {
    return client.get(`/workspace/get?workspaceId=${id}`);
  }

  deleteWorkspace(id: string): Promise<void> {
    return client.delete(`/workspace/delete?workspaceId=${id}`);
  }
}

export const workspaceService = new WorkspaceService();
