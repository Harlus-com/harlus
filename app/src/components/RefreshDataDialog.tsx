import React, { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { fileService } from "@/api/fileService";
import { Workspace } from "@/api/workspace_types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RefreshCw, Check } from "lucide-react";

interface RefreshDataDialogProps {
  workspace: Workspace | null;
  reloadWorkspace: () => void;
}

export default function RefreshDataDialog({
  workspace,
  reloadWorkspace,
}: RefreshDataDialogProps) {
  const [isRefreshingOnlineData, setIsRefreshingOnlineData] = useState(false);
  const [isRefreshSuccess, setIsRefreshSuccess] = useState(false);
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);

  // Map of destination folders per workspace ID
  const [workspaceDestinations, setWorkspaceDestinations] = useState<Map<string, string | null>>(new Map());

  // Current destination folder for the active workspace (as a single string)
  const [currentWorkspaceDestination, setCurrentWorkspaceDestination] = useState<string | null>(null);

  // State for the input field in the dialog (always a single string path)
  const [dialogInputDestination, setDialogInputDestination] = useState<string>('');

  // Effect to update currentWorkspaceDestination and dialogInputDestination when the workspace changes
  useEffect(() => {
    if (workspace?.id) {
      const storedDestination = workspaceDestinations.get(workspace.id) || null;
      setCurrentWorkspaceDestination(storedDestination);
      setDialogInputDestination(storedDestination || '');
    } else {
      setCurrentWorkspaceDestination(null);
      setDialogInputDestination('');
    }
  }, [workspace, workspaceDestinations]);

  const performRefresh = useCallback(async (destination: string | null) => {
    if (isRefreshingOnlineData || !workspace?.id) {
      return;
    }

    setIsRefreshingOnlineData(true);
    setIsRefreshSuccess(false);

    try {
      const finalDestination = destination === '' ? null : destination;

      const refreshedFiles = await fileService.refreshOnlineData(workspace, finalDestination);
      console.log("Online data refreshed:", refreshedFiles);

      reloadWorkspace();

      setIsRefreshSuccess(true);
      toast.success("Successful refresh!");

      setTimeout(() => {
        setIsRefreshSuccess(false);
      }, 2000);
    } catch (error: any) {
      console.error("Error refreshing online data:", error);
      toast.error(`Error refreshing online data: ${error.message || "Unknown error"}`);
      setIsRefreshSuccess(false);
    } finally {
      setIsRefreshingOnlineData(false);
    }
  }, [isRefreshingOnlineData, workspace, reloadWorkspace]);

  const handleRefreshButtonClick = useCallback(() => {
    if (currentWorkspaceDestination === null || currentWorkspaceDestination === '') {
      setDialogInputDestination(currentWorkspaceDestination || '');
      setShowDownloadDialog(true);
    } else {
      performRefresh(currentWorkspaceDestination);
    }
  }, [currentWorkspaceDestination, performRefresh]);

  const handleDialogConfirm = useCallback(() => {
    if (workspace?.id) {
      const newDestinationString = dialogInputDestination;

      setWorkspaceDestinations(prevMap => {
        const newMap = new Map(prevMap);
        newMap.set(workspace.id, newDestinationString === '' ? null : newDestinationString);
        return newMap;
      });
      setCurrentWorkspaceDestination(newDestinationString === '' ? null : newDestinationString);
      performRefresh(newDestinationString);
    }
    setShowDownloadDialog(false);
  }, [dialogInputDestination, performRefresh, workspace]);

  const handleDialogCancel = useCallback(() => {
    setShowDownloadDialog(false);
    setDialogInputDestination(currentWorkspaceDestination || '');
  }, [currentWorkspaceDestination]);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleRefreshButtonClick}
        disabled={isRefreshingOnlineData}
        className="group relative ml-2"
      >
        {isRefreshingOnlineData ? (
          <RefreshCw size={16} className="animate-spin" />
        ) : isRefreshSuccess ? (
          <Check size={16} className="text-green-500" />
        ) : (
          <RefreshCw size={16} />
        )}
        <div className="absolute top-full left-0 mt-1 px-2 py-1 text-xs bg-popover text-popover-foreground rounded-md shadow-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
          {isRefreshingOnlineData
            ? "Refreshing online data..."
            : isRefreshSuccess
            ? "Refreshed!"
            : "Refresh Online Data"}
        </div>
      </Button>

      <AlertDialog open={showDownloadDialog} onOpenChange={setShowDownloadDialog}>
        <AlertDialogContent className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-semibold text-gray-900 dark:text-white">
              Select Download Destination
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600 dark:text-gray-300 mt-2">
              Please enter the folder path where you want to download the online data for this workspace.
              If left blank, data will be downloaded to the default workspace directory.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Input
              id="destination-folder"
              placeholder="e.g., /path/to/your/folder or leave blank for default"
              value={dialogInputDestination}
              onChange={(e) => setDialogInputDestination(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
          <AlertDialogFooter className="flex justify-end space-x-3 mt-4">
            <AlertDialogCancel asChild>
              <Button
                variant="outline"
                onClick={handleDialogCancel}
                className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                onClick={handleDialogConfirm}
                className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                Confirm
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}