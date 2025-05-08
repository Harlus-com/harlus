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
  const statusText = getStatusText(status);
  
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <div className={cn("w-1.5 h-1.5 rounded-full", getStatusColor(status))} />
      {/* Only show text for statuses other than OUT_OF_DATE */}
      {status !== "OUT_OF_DATE" && (
        <span className="text-xs text-muted-foreground">
          {statusText}
        </span>
      )}
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
      return "bg-red-500 opacity-70";
  }
}

export default FileStatusIndicator;
