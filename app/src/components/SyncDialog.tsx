import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Workspace } from "@/api/workspace_types";
import { useFileContext } from "@/files/FileContext";

interface SyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace: Workspace | null;
  folderPath?: string[];
}

const SyncDialog: React.FC<SyncDialogProps> = ({
  open,
  onOpenChange,
  workspace,
  folderPath,
}) => {
  const {
    getFiles,
    getFileSyncStatus,
    startSyncFile,
    workspaceFileToLocalFile,
  } = useFileContext();
  const files = getFiles();

  const [syncTracked, setSyncTracked] = React.useState(true);
  const [syncUntracked, setSyncUntracked] = React.useState(false);
  const [isSyncing, setIsSyncing] = React.useState(false);

  // Reset state when dialog closes
  React.useEffect(() => {
    if (!open) {
      setSyncTracked(true);
      setSyncUntracked(false);
      setIsSyncing(false);
    }
  }, [open]);

  // Filter files based on folderPath if provided
  const filteredFiles = folderPath
    ? files.filter((file) => {
        return (
          file.appDir.slice(0, folderPath.length).join("/") ===
          folderPath.join("/")
        );
      })
    : files;

  const trackedFiles = filteredFiles.filter(
    (file) => getFileSyncStatus(file.id) !== "UNTRACKED"
  );
  const untrackedFiles = filteredFiles.filter(
    (file) => getFileSyncStatus(file.id) === "UNTRACKED"
  );

  const totalFilesToSync =
    (syncTracked ? trackedFiles.length : 0) +
    (syncUntracked ? untrackedFiles.length : 0);

  const handleSync = async () => {
    if (!workspace) return;

    setIsSyncing(true);
    try {
      // Sync tracked files with force sync
      if (syncTracked) {
        for (const file of trackedFiles) {
          const localFile = workspaceFileToLocalFile(file);
          if (localFile) {
            await startSyncFile(localFile);
          }
        }
      }

      // Sync untracked files with start sync
      if (syncUntracked) {
        for (const file of untrackedFiles) {
          const localFile = workspaceFileToLocalFile(file);
          if (localFile) {
            await startSyncFile(localFile);
          }
        }
      }
    } finally {
      setIsSyncing(false);
      onOpenChange(false);
    }
  };

  const getDialogTitle = () => {
    if (folderPath && folderPath.length > 0) {
      return `Sync Files in "${folderPath[folderPath.length - 1]}"`;
    }
    return "Sync Files in Workspace";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{getDialogTitle()}</DialogTitle>
          <DialogDescription className="pt-2">
            By syncing files, they become available to Harlus AI
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="tracked"
              checked={syncTracked}
              onCheckedChange={(checked) => setSyncTracked(checked as boolean)}
            />
            <Label htmlFor="tracked" className="flex items-center gap-2">
              Sync Tracked Files
              <span className="text-sm text-muted-foreground">
                ({trackedFiles.length})
              </span>
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="untracked"
              checked={syncUntracked}
              onCheckedChange={(checked) =>
                setSyncUntracked(checked as boolean)
              }
            />
            <Label htmlFor="untracked" className="flex items-center gap-2">
              Sync Untracked Files
              <span className="text-sm text-muted-foreground">
                ({untrackedFiles.length})
              </span>
            </Label>
          </div>
          <div className="pt-2 border-t">
            <p className="text-sm text-muted-foreground">
              Total Files to be synced: {totalFilesToSync}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSyncing}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSync}
            disabled={totalFilesToSync === 0 || isSyncing}
          >
            {isSyncing ? "Syncing..." : "Sync"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SyncDialog;
