import React from "react";
import { format } from "date-fns";
import { useFileContext } from "@/files/FileContext";
import { getStatusInfo } from "@/components/FileStatusIndicator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface FileInfoDialogProps {
  file: LocalFile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FileInfoDialog: React.FC<FileInfoDialogProps> = ({
  file,
  open,
  onOpenChange,
}) => {
  const { getFileSyncStatus } = useFileContext();
  const [lastModified, setLastModified] = React.useState<Date | null>(null);
  const status = getFileSyncStatus(file.contentHash) || "UNTRACKED";
  const { label, moreInfo } = getStatusInfo(status);

  React.useEffect(() => {
    if (open) {
      window.electron.getFileStats(file.absolutePath).then((stats) => {
        setLastModified(new Date(stats.mtime));
      });
    }
  }, [open, file]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>File Information</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Location:</span>
              <span>{file.absolutePath}</span>
            </div>
            {lastModified && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Modified:</span>
                <span>{format(lastModified, "PPpp")}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status:</span>
              <span>
                {label}
                {moreInfo && (
                  <span className="text-muted-foreground"> ({moreInfo})</span>
                )}
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FileInfoDialog;
