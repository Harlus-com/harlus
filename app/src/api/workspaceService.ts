import { Workspace } from "./workspace_types";
import { client } from "./client";

class WorkspaceService {
  constructor() {}

  getWorkspaces(): Promise<Workspace[]> {
    return client.get("/workspace/all");
  }

  createWorkspace(data: { name: string; companyName: string }): Promise<Workspace> {
    return client.post("/workspace/create", data);
  }

  getWorkspace(id: string): Promise<Workspace> {
    return client.get(`/workspace/get/${id}`);
  }
}

export const workspaceService = new WorkspaceService();
