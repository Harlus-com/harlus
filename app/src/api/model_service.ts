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
    const isUploaded = await client.get(
      `/file/is_uploaded?fileId=${file.contentHash}`
    );
    console.log("isUploaded", isUploaded);
    if (!isUploaded) {
      console.log("uploading file", file.absolutePath);
      await client.upload(file, workspaceId);
    }
    return client.post(`/file/sync`, {
      fileId: file.contentHash,
      workspaceId: workspaceId,
      force: false, // TODO: Remove
    });
  }

  forceSyncFile(workspaceId: string, file: LocalFile): Promise<boolean> {
    fileService.deleteFile(toWorkspaceFile(workspaceId, file));
    client.upload(file, workspaceId);
    return client.post(`/file/sync`, {
      fileId: file.contentHash,
      workspaceId: workspaceId,
      force: true, // TODO: Remove
    });
  }
}

export const modelService = new ModelService();
