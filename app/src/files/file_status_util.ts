import { SyncStatus } from "@/api/workspace_types";

export interface StatusInfo {
  color: string;
  label: string;
  moreInfo?: string;
}

export function getStatusInfo(status: SyncStatus): StatusInfo {
  switch (status) {
    case "SYNC_COMPLETE":
      return {
        color: "bg-green-500",
        label: "Synced",
        moreInfo: "Ready for AI",
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
        moreInfo: "Never been synced",
      };
    case "UNTRACKED":
      return {
        color: "bg-gray-500",
        label: "Untracked",
        moreInfo: "Not tracked by the server",
      };
    default:
      const exhaustiveCheck: never = status;
      throw new Error("Unknown status: " + exhaustiveCheck);
  }
}
