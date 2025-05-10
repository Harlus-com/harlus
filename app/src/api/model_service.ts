import { client } from "./client";
import { SyncStatus } from "./workspace_types";
import { WorkspaceFile } from "./workspace_types";

class ModelService {
  // Syncs all the files in a workspace
  async syncWorkspace(workspaceId: string): Promise<boolean> {
    const response = await client.post(`/workspace/sync`, { workspaceId });
    return response;
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
