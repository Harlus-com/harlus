import {
  ScanSearch,
  RefreshCw,
  Columns2,
  MessagesSquare,
  MessageSquareQuote,
  Files,
  LayoutDashboard,
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
import { OpenFilesOptions } from "@/files/file_types";
import { FilesToOpen } from "@/files/file_types";
import { useFileContext } from "@/files/FileContext";
import { useFileViewContext } from "@/files/FileViewContext";

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
  const { getOpenFiles, setFileGroupCount, handleOpenFiles } =
    useFileViewContext();

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
            openFiles={handleOpenFiles}
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
            className="group relative"
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
