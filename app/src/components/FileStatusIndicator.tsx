import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import { WorkspaceFile, SyncStatus } from "@/api/workspace_types";
import { modelService } from "@/api/model_service";
import { withTimeout } from "@/core/timeout_util";

interface FileStatusIndicatorProps {
  file: WorkspaceFile;
  className?: string;
}
export interface FileStatusIndicatorHandle {
  getStatus: () => SyncStatus;
  setStatus: (status: SyncStatus) => void;
}

class FileStatusPollingHelper {
  private currentStatus: SyncStatus;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private lastStatusChange: Date = new Date();

  constructor(
    private readonly file: WorkspaceFile,
    private readonly setStatus: (status: SyncStatus) => void
  ) {}

  start(status: SyncStatus) {
    console.log("Starting polling for", this.file.name, "with status", status);
    this.currentStatus = status;
    this.lastStatusChange = new Date();
    this.poll();
  }

  end() {
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  private async poll() {
    const lastStatusChangeSecondsAgo =
      (new Date().getTime() - this.lastStatusChange.getTime()) / 1000;
    const status = await this.getStatus({ timeoutSeconds: 10 });
    console.log("Polling for", this.file.name, "got status", status);
    if (status !== this.currentStatus) {
      this.currentStatus = status;
      this.lastStatusChange = new Date();
      this.setStatus(status);
    }
    switch (status) {
      case "SYNC_PENDING":
        if (lastStatusChangeSecondsAgo > 60) {
          this.setStatus("SYNC_ERROR");
          return;
        }
        this.schedulePoll({ seconds: 1 });
        return;
      case "SYNC_IN_PROGRESS":
        if (lastStatusChangeSecondsAgo > 60 * 5) {
          this.setStatus("SYNC_ERROR");
          return;
        }
        this.schedulePoll({ seconds: 1 });
        return;
      case "SYNC_COMPLETE":
      case "SYNC_PENDING":
      case "SYNC_ERROR":
      case "UNKNOWN":
        return;
    }
  }
  private async getStatus(timeout: {
    timeoutSeconds: number;
  }): Promise<SyncStatus> {
    try {
      const status = await withTimeout(
        modelService.getFileSyncStatus(this.file),
        timeout.timeoutSeconds * 1000
      );
      return status;
    } catch (err) {
      console.warn(`Polling for ${this.file.name} timed out or failed:`, err);
      return "SYNC_ERROR";
    }
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
const FileStatusIndicator = forwardRef<
  FileStatusIndicatorHandle,
  FileStatusIndicatorProps
>(({ file, className }, ref) => {
  const [status, setStatus] = useState<SyncStatus>("UNKNOWN");
  const statusPollingHelper = new FileStatusPollingHelper(file, setStatus);
  useImperativeHandle(ref, () => ({
    getStatus: () => status,
    setStatus: (newStatus: SyncStatus) => {
      setStatus(newStatus);
    },
  }));
  useEffect(() => {
    statusPollingHelper.start(status);
    return () => {
      statusPollingHelper.end();
    };
  }, [file]);
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className={cn("w-2 h-2 rounded-full", getStatusColor(status))} />
      <span className="text-xs text-muted-foreground">
        {getStatusText(status)}
      </span>
    </div>
  );
});

function getStatusText(status: SyncStatus) {
  switch (status) {
    case "SYNC_IN_PROGRESS":
      return "Syncing...";
    case "SYNC_COMPLETE":
      return "Synced";
    case "SYNC_PENDING":
      return "Pending...";
    case "SYNC_ERROR":
      return "Error";
    case "UNKNOWN":
      return "Needs Sync";
  }
}

function getStatusColor(status: SyncStatus) {
  switch (status) {
    case "SYNC_IN_PROGRESS":
      return "bg-blue-500";
    case "SYNC_COMPLETE":
      return "bg-green-500";
    case "SYNC_PENDING":
      return "bg-gray-500";
    case "SYNC_ERROR":
      return "bg-red-500";
    case "UNKNOWN":
      return "bg-yellow-500";
  }
}

export default FileStatusIndicator;
