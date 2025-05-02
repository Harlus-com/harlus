import {
  ScanSearch,
  RefreshCw,
  Columns2,
  MessagesSquare,
  MessageSquareQuote,
  Files,
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

export type WorkSpaceHeaderProps = {
  onFileGroupCountChange: (fileGroupCount: FileGroupCount) => void;
  togglePanelVisibility: (panelId: TopLevelPanelId) => void;
  openContrastAnalysis: () => void;
  refreshSyncStatus: () => void;
};

export default function WorkspaceHeader({
  onFileGroupCountChange,
  togglePanelVisibility,
  openContrastAnalysis,
  refreshSyncStatus,
}: WorkSpaceHeaderProps) {
  return (
    <header className="border-b border-border p-4 flex items-center justify-between">
      <h1 className="text-xl font-semibold mr-4">APPL</h1>
      <div className="flex-1" />
      <div className="flex items-center space-x-2">
        <div className="flex items-center space-x-2 border-r border-border pr-6">
          <Button
            onClick={refreshSyncStatus}
            variant="outline"
            size="sm"
            className="group relative"
          >
            <RefreshCw size={16} />
            <div className="absolute top-full left-0 mt-1 px-2 py-1 text-xs bg-popover text-popover-foreground rounded-md shadow-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              Refresh
            </div>
          </Button>

          <Button
            onClick={openContrastAnalysis}
            variant="outline"
            size="sm"
            className="group relative"
          >
            <ScanSearch size={16} />
            <div className="absolute top-full left-0 mt-1 px-2 py-1 text-xs bg-popover text-popover-foreground rounded-md shadow-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              Analyze
            </div>
          </Button>
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
                onClick={() => onFileGroupCountChange(FileGroupCount.ONE)}
              >
                1 File Group
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onFileGroupCountChange(FileGroupCount.TWO)}
              >
                2 File Groups
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onFileGroupCountChange(FileGroupCount.THREE)}
              >
                3 File Groups
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onFileGroupCountChange(FileGroupCount.FOUR)}
              >
                4 File Groups
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
            onClick={() => togglePanelVisibility(TopLevelPanelId.COMMENTS)}
            variant="outline"
            size="sm"
            className="group relative"
          >
            <MessageSquareQuote size={16} />
            <div className="absolute top-full right-0 mt-1 px-2 py-1 text-xs bg-popover text-popover-foreground rounded-md shadow-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              Toggle Comments
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
