import React from "react";
import { cn } from "@/lib/utils";
import { WorkspaceFile, SyncStatus } from "@/api/workspace_types";
import { useFileContext } from "@/files/FileContext";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getStatusInfo } from "./file_status_util";

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
    <div className={cn("flex items-center", className)}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="p-1 -m-1 cursor-default">
              <div className={cn("w-2 h-2 rounded-full", color)} />
            </div>
          </TooltipTrigger>
          <TooltipContent side="left" align="start" alignOffset={30}>
            <div className="text-xs font-semibold">{label}</div>
            {moreInfo && (
              <div className="text-gray-400 text-[10px]">{moreInfo}</div>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};

export default FileStatusIndicator;
