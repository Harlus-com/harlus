import React from "react";
import { cn } from "@/lib/utils";
import { WorkspaceFile, SyncStatus } from "@/api/workspace_types";
import { useFileContext } from "@/files/FileContext";

interface FileStatusIndicatorProps {
  file: WorkspaceFile;
  className?: string;
}

const FileStatusIndicator: React.FC<FileStatusIndicatorProps> = ({
  file,
  className,
}) => {
  const { getFileSyncStatus } = useFileContext();
  const status = getFileSyncStatus(file.id) || "UNKNOWN";
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className={cn("w-2 h-2 rounded-full", getStatusColor(status))} />
      <span className="text-xs text-muted-foreground">
        {getStatusText(status)}
      </span>
    </div>
  );
};

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
