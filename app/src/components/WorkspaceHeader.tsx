import {
  ScanSearch,
  RefreshCw,
  Columns2,
  MessagesSquare,
  MessageSquareQuote,
  Files,
  LayoutDashboard,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileGroupCount } from "./panels";
import { TopLevelPanelId } from "./panels";
import { Workspace, WorkspaceFile } from "@/api/workspace_types";
import { useNavigate } from "react-router-dom";
import ContrastAnalysisDialog from "./ContrastAnalysisDialog";
import { useFileContext } from "@/files/FileContext";
import { useFileViewContext } from "@/files/FileViewContext";
import { useState } from "react";
import { toast } from "sonner";
import { fileService } from "@/api/fileService";

export type WorkSpaceHeaderProps = {
  workspace: Workspace;
  togglePanelVisibility: (panelId: TopLevelPanelId) => void;
  setVisiblePanels: (panelIds: TopLevelPanelId[]) => void;
  reloadWorkspace: () => void;
};

export default function WorkspaceHeader({
  workspace,
  togglePanelVisibility,
  setVisiblePanels,
  reloadWorkspace,
}: WorkSpaceHeaderProps) {
  const navigate = useNavigate();
  const { getFiles } = useFileContext();
  const { setFileGroupCount } = useFileViewContext();

  const [isRefreshingOnlineData, setIsRefreshingOnlineData] = useState(false);
  const [isRefreshSuccess, setIsRefreshSuccess] = useState(false);

  // TODO: move this to a separate dialogfile
  const handleRefreshOnlineData = async () => {
    if (isRefreshingOnlineData || !workspace?.id) {
      return;
    }

    setIsRefreshingOnlineData(true);
    setIsRefreshSuccess(false);

    try {
      const refreshedFiles = await fileService.refreshOnlineData(workspace.id);
      console.log("Online data refreshed:", refreshedFiles);

      reloadWorkspace();

      setIsRefreshSuccess(true);
      toast.success("Online data refresh initiated!");

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
  };

  return (
    <header className="border-b border-border p-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/")}
          className="group relative"
        >
          <LayoutDashboard size={16} />
          <div className="absolute top-full left-0 mt-1 px-2 py-1 text-xs bg-popover text-popover-foreground rounded-md shadow-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            Switch Workspace
          </div>
        </Button>
        <h1 className="text-xl font-semibold">{workspace?.name || ""}</h1>
        {/* REFRESH BUTTON FOR ONLINE DATA */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefreshOnlineData} // Call our new generic handler
          disabled={isRefreshingOnlineData} // Disable button when refreshing
          className="group relative ml-2"
        >
          {/* Conditional rendering for the icon */}
          {isRefreshingOnlineData ? (
            <RefreshCw size={16} className="animate-spin" /> // Spinning refresh icon when loading
          ) : isRefreshSuccess ? (
            <Check size={16} className="text-green-500" /> // Green tick on success
          ) : (
            <RefreshCw size={16} /> // Default refresh icon
          )}
          <div className="absolute top-full left-0 mt-1 px-2 py-1 text-xs bg-popover text-popover-foreground rounded-md shadow-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            {isRefreshingOnlineData
              ? "Refreshing online data..."
              : isRefreshSuccess
              ? "Refreshed!"
              : "Refresh Online Data"}
          </div>
        </Button>
      </div>
      <div className="flex-1" />
      <div className="flex items-center space-x-2">
        <div className="flex items-center space-x-2 border-r border-border pr-6">
          <Button
            onClick={reloadWorkspace}
            variant="outline"
            size="sm"
            className="group relative"
          >
            <RefreshCw size={16} />
            <div className="absolute top-full left-0 mt-1 px-2 py-1 text-xs bg-popover text-popover-foreground rounded-md shadow-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              Reload
            </div>
          </Button>

          <ContrastAnalysisDialog
            files={getFiles()}
            setVisiblePanels={setVisiblePanels}
          />
        </div>

        <div className="flex items-center space-x-2 pl-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="group relative">
                <Columns2 size={16} />
                <div className="absolute top-full right-0 mt-1 px-2 py-1 text-xs bg-popover text-popover-foreground rounded-md shadow-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  File Layout
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                onClick={() => setFileGroupCount(FileGroupCount.ONE)}
              >
                1 File Group
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setFileGroupCount(FileGroupCount.TWO)}
              >
                2 File Groups
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            onClick={() => togglePanelVisibility(TopLevelPanelId.FILE_EXPLORER)}
            variant="outline"
            size="sm"
            className="group relative"
          >
            <Files size={16} />
            <div className="absolute top-full right-0 mt-1 px-2 py-1 text-xs bg-popover text-popover-foreground rounded-md shadow-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              Toggle File Explorer
            </div>
          </Button>

          <Button
            onClick={() => togglePanelVisibility(TopLevelPanelId.CHAT)}
            variant="outline"
            size="sm"
            className="grou p relative"
          >
            <MessagesSquare size={16} />
            <div className="absolute top-full right-0 mt-1 px-2 py-1 text-xs bg-popover text-popover-foreground rounded-md shadow-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              Toggle Chat
            </div>
          </Button>
        </div>
      </div>
    </header>
  );
}
