import { Workspace } from "./types";
import { client } from "./client";

class WorkspaceService {
  constructor() {}

  getWorkspaces(): Promise<Workspace[]> {
    return client.get("/workspace/all");
  }

  createWorkspace(name: string): Promise<Workspace> {
    return client.post("/workspace/create", { name });
  }

  getWorkspace(id: string): Promise<Workspace> {
    return client.get(`/workspace/get/${id}`);
  }
}

export const workspaceService = new WorkspaceService();
