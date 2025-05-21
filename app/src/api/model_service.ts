import { client } from "./client";
import { SyncStatus } from "./workspace_types";
import { fileService } from "./fileService";
import { toWorkspaceFile } from "@/files/file_util";

class ModelService {
  getFileSyncStatuses(
    workspaceId: string
  ): Promise<Record<string, SyncStatus>> {
    return client.get(`/workspace/files/status?workspaceId=${workspaceId}`);
  }

  async startSyncFile(workspaceId: string, file: LocalFile): Promise<boolean> {
    // Will be a no-op if the file is already uploaded
    await fileService.uploadFile(workspaceId, file);
    return client.post(`/file/sync`, {
      fileId: file.contentHash,
      workspaceId: workspaceId,
    });
  }

  async forceSyncFile(workspaceId: string, file: LocalFile): Promise<boolean> {
    await fileService.deleteFile(toWorkspaceFile(workspaceId, file));
    return this.startSyncFile(workspaceId, file);
  }
}

export const modelService = new ModelService();
