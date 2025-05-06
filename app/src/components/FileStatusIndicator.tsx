import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { WorkspaceFile, SyncStatus } from "@/api/workspace_types";

interface FileStatusIndicatorProps {
  file: WorkspaceFile;
  className?: string;
}

const FileStatusIndicator: React.FC<FileStatusIndicatorProps> = ({
  file,
  className,
}) => {
  const status = file.status || "OUT_OF_DATE";
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
    default:
      return "Needs Sync";
  }
}

function getStatusColor(status: SyncStatus) {
  switch (status) {
    case "SYNC_IN_PROGRESS":
      return "bg-yellow-500";
    case "SYNC_COMPLETE":
      return "bg-green-500";
    default:
      return "bg-red-500";
  }
}

export default FileStatusIndicator;
