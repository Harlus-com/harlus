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
  const status = getFileSyncStatus(file.id) || "UNTRACKED";
  const { color, label, moreInfo } = getStatusInfo(status);
  return (
    <div className={cn("flex items-center gap-2 group relative", className)}>
      <div className={cn("w-2 h-2 rounded-full", color)} />
      <div className="absolute left-0 top-full mt-1 hidden group-hover:block bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-50">
        <div>{label}</div>
        {moreInfo && (
          <div className="text-gray-400 text-[10px]">{moreInfo}</div>
        )}
      </div>
    </div>
  );
};

interface StatusInfo {
  color: string;
  label: string;
  moreInfo?: string;
}
function getStatusInfo(status: SyncStatus): StatusInfo {
  switch (status) {
    case "SYNC_COMPLETE":
      return {
        color: "bg-green-500",
        label: "Synced",
      };
    case "SYNC_PENDING":
      return {
        color: "bg-blue-500",
        label: "Sync Pending...",
      };
    case "SYNC_IN_PROGRESS":
      return {
        color: "bg-blue-500",
        label: "Syncing...",
      };
    case "SYNC_INCOMPLETE":
      return {
        color: "bg-orange-500",
        label: "Needs Sync",
        moreInfo: "Sync was interrupted",
      };
    case "SYNC_PARTIAL_SUCCESS":
      return {
        color: "bg-orange-500",
        label: "Needs Sync",
        moreInfo: "Sync only partially succeeded",
      };
    case "SYNC_ERROR":
      return {
        color: "bg-red-500",
        label: "Error",
        moreInfo: "Sync failed",
      };
    case "SYNC_NOT_STARTED":
      return {
        color: "bg-yellow-500",
        label: "Needs Sync",
        moreInfo: "This file has never been synced",
      };
    case "UNTRACKED":
      return {
        color: "bg-gray-500",
        label: "Untracked",
        moreInfo: "This file is not tracked by the server",
      };
    default:
      const exhaustiveCheck: never = status;
      throw new Error("Unknown status: " + exhaustiveCheck);
  }
}

export default FileStatusIndicator;
