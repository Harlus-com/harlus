import { modelService } from "@/api/model_service";
import { SyncStatus } from "@/api/workspace_types";

export class FileStatusManager {
  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly workspaceId: string,
    private readonly onStatusResponse: (
      statuses: Record<string, SyncStatus>
    ) => void
  ) {}

  start() {
    if (this.timeoutId != null) {
      console.log("File status manager already running");
      return;
    }
    console.log("Starting file status manager");
    this.poll();
  }

  end() {
    if (this.timeoutId == null) {
      console.log("File status manager already ended");
      return;
    }
    console.log("Ending file status manager");
    clearTimeout(this.timeoutId);
    this.timeoutId = null;
  }

  private async poll() {
    const statuses = await modelService.getFileSyncStatuses(this.workspaceId);
    console.log("Poll response", statuses);
    this.onStatusResponse(statuses);
    if (this.hasActiveStatus(statuses)) {
      this.schedulePoll({ seconds: 1 });
    } else {
      this.end();
    }
  }

  private hasActiveStatus(response: Record<string, SyncStatus>) {
    return Object.values(response).some(
      (s) => s === "SYNC_PENDING" || s === "SYNC_IN_PROGRESS"
    );
  }

  schedulePoll(interval: { seconds?: number; milliseconds?: number }) {
    const seconds = interval.seconds || 0;
    const milliseconds = interval.milliseconds || 0;
    this.timeoutId = setTimeout(
      () => this.poll(),
      seconds * 1000 + milliseconds
    );
  }
}
