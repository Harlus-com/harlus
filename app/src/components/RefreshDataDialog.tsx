import React, { useState, useCallback, useMemo } from 'react';
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
    const defaultStartDate = useMemo(() => {
        const prevYear = new Date().getFullYear() - 1;
        return `${prevYear}-01-01`;
      }, []);
    
      const [isRefreshingOnlineData, setIsRefreshingOnlineData] = useState(false);
      const [isRefreshSuccess, setIsRefreshSuccess] = useState(false);
      const [showDownloadDialog, setShowDownloadDialog] = useState(false);
      const [dialogInputDestination, setDialogInputDestination] = useState<string>("");
      const [dialogInputStartDate, setDialogInputStartDate] = useState<string>(defaultStartDate);
    
      const performRefresh = useCallback(
        async (destination: string, startDate: string) => {
          if (isRefreshingOnlineData || !workspace?.id) return;
    
          setIsRefreshingOnlineData(true);
          setIsRefreshSuccess(false);
    
          try {
            const finalDestination = destination === '' ? null : destination;
            await fileService.refreshOnlineData(workspace, finalDestination, startDate);
            reloadWorkspace();
    
            setIsRefreshSuccess(true);
            toast.success("Successful refresh!");
            setTimeout(() => setIsRefreshSuccess(false), 2000);
          } catch (error: any) {
            console.error("Error refreshing online data:", error);
            toast.error(`Error refreshing online data: ${error.message || "Unknown error"}`);
            setIsRefreshSuccess(false);
          } finally {
            setIsRefreshingOnlineData(false);
          }
        },
        [isRefreshingOnlineData, workspace, reloadWorkspace]
      );
    
      const handleRefreshButtonClick = useCallback(() => {
        setDialogInputDestination("");
        setDialogInputStartDate(defaultStartDate);
        setShowDownloadDialog(true);
      }, [defaultStartDate]);
    
      const handleDialogConfirm = useCallback(() => {
        setShowDownloadDialog(false);
        performRefresh(dialogInputDestination, dialogInputStartDate);
      }, [dialogInputDestination, dialogInputStartDate, performRefresh]);
    
      const handleDialogCancel = useCallback(() => {
        setShowDownloadDialog(false);
      }, []);
    
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
                  Select Download Options
                </AlertDialogTitle>
                <AlertDialogDescription className="text-gray-600 dark:text-gray-300 mt-2">
                  Please enter the folder path where you want to download the online data, and select the start date for the data pull.
                </AlertDialogDescription>
              </AlertDialogHeader>
    
              <div className="py-4">
                <Input
                  id="destination-folder"
                  placeholder="/path/to/your/folder"
                  value={dialogInputDestination}
                  onChange={(e) => setDialogInputDestination(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
    
              <div className="py-4">
                <label htmlFor="start-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Start Date
                </label>
                <Input
                  type="date"
                  id="start-date"
                  value={dialogInputStartDate}
                  onChange={(e) => setDialogInputStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
    
              <AlertDialogFooter className="flex justify-end space-x-3 mt-4">
                <AlertDialogCancel asChild>
                  <Button variant="outline" onClick={handleDialogCancel} className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    Cancel
                  </Button>
                </AlertDialogCancel>
                <AlertDialogAction asChild>
                  <Button onClick={handleDialogConfirm} className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors">
                    Confirm
                  </Button>
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      );
    }
    