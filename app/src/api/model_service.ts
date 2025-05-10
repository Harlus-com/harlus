import { client } from "./client";
import { SyncStatus } from "./workspace_types";
import { WorkspaceFile } from "./workspace_types";

class ModelService {
  // Get the sync status of a workspace
  async getSyncStatus(workspaceId: string): Promise<string> {
    const response = await client.get(`/workspace/status/${workspaceId}`);
    return response;
  }

  // Update the knowledge graph for a workspace
  async syncWorkspace(workspaceId: string): Promise<boolean> {
    const response = await client.post(`/workspace/sync`, { workspaceId });
    return response;
  }

  getFileSyncStatus(file: WorkspaceFile): Promise<SyncStatus> {
    return client.get(`/file/sync/status/${file.id}`);
  }

  getFileSyncStatuses(
    workspaceId: string
  ): Promise<Record<string, SyncStatus>> {
    return client.get(`/workspace/file_statuses?workspaceId=${workspaceId}`);
  }

  startSyncFile(file: WorkspaceFile): Promise<boolean> {
    return client.post(`/file/sync`, {
      fileId: file.id,
      workspaceId: file.workspaceId,
      force: false,
    });
  }

  forceSyncFile(file: WorkspaceFile): Promise<boolean> {
    return client.post(`/file/sync`, {
      fileId: file.id,
      workspaceId: file.workspaceId,
      force: true,
    });
  }
}

export const modelService = new ModelService();
