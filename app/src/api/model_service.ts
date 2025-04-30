import { client } from "./client";

class ModelService {
  // Get the sync status of a workspace
  async getSyncStatus(workspaceId: string): Promise<string> {
    const response = await client.get(`/workspace/status/${workspaceId}`);
    return response;
  }

  // Update the knowledge graph for a workspace
  async updateKnowledgeGraph(workspaceId: string): Promise<boolean> {
    const response = await client.post(`/workspace/sync`, { workspaceId });
    return response;
  }
}

export const modelService = new ModelService();
