import {
  ScanSearch,
  RefreshCw,
  Columns2,
  MessagesSquare,
  Files,
} from "lucide-react";
import FileExplorer from "@/components/FileExplorer";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, MessageSquareQuote } from "lucide-react";
import {
  PanelGroup,
  Panel,
  PanelResizeHandle,
  ImperativePanelHandle,
} from "react-resizable-panels";
import { useRef, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

enum FileGroupCount {
  ONE = 1,
  TWO = 2,
  THREE = 3,
  FOUR = 4,
}

enum TopLevelPanelId {
  FILE_EXPLORER = "file-explorer",
  FILE_VIEWER = "file-viewer",
  COMMENTS = "comments",
  CHAT = "chat",
}

class TopLevelPanel {
  constructor(
    readonly id: TopLevelPanelId,
    readonly defaultSize: number,
    readonly minSize: number = 5
  ) {}
}

// The default sizes scale relative to each other.
// They work best when the sum of all the default sizes is 100.
// If one of the panels is not visible, they will be "resacled" to add up to 100.
const FILE_EXPLORER = new TopLevelPanel(TopLevelPanelId.FILE_EXPLORER, 15);
const FILE_VIEWER = new TopLevelPanel(TopLevelPanelId.FILE_VIEWER, 50);
const COMMENTS = new TopLevelPanel(TopLevelPanelId.COMMENTS, 15);
const CHAT = new TopLevelPanel(TopLevelPanelId.CHAT, 20);

export default function Workspace() {
  const [fileGroupCount, setFileGroupCount] = useState<FileGroupCount>(
    FileGroupCount.TWO
  );
  const [visiblePanels, setVisiblePanels] = useState<TopLevelPanelId[]>([
    TopLevelPanelId.FILE_EXPLORER,
    TopLevelPanelId.FILE_VIEWER,
    TopLevelPanelId.COMMENTS,
    TopLevelPanelId.CHAT,
  ]);

  const fileExplorerPanelRef = useRef<ImperativePanelHandle>(null);

  return (
    <div className="h-screen">
      <header className="border-b border-border p-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold mr-4">APPL</h1>
        <div className="flex-1" />
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-2 border-r border-border pr-6">
            <Button
              onClick={() => {}}
              variant="outline"
              size="sm"
              className="group relative"
            >
              <RefreshCw size={16} />
              <div className="absolute top-full left-0 mt-1 px-2 py-1 text-xs bg-popover text-popover-foreground rounded-md shadow-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                Force Sync
              </div>
            </Button>

            <Button
              onClick={() => {}}
              variant="outline"
              size="sm"
              className="group relative"
            >
              <ScanSearch size={16} />
              <div className="absolute top-full left-0 mt-1 px-2 py-1 text-xs bg-popover text-popover-foreground rounded-md shadow-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                Contrast Analysis
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
                  onClick={() => setFileGroupCount(FileGroupCount.ONE)}
                >
                  1 File Group
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setFileGroupCount(FileGroupCount.TWO)}
                >
                  2 File Groups
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setFileGroupCount(FileGroupCount.THREE)}
                >
                  3 File Groups
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setFileGroupCount(FileGroupCount.FOUR)}
                >
                  4 File Groups
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              onClick={() => {
                if (visiblePanels.includes(TopLevelPanelId.COMMENTS)) {
                  setVisiblePanels(
                    visiblePanels.filter(
                      (panel) => panel !== TopLevelPanelId.COMMENTS
                    )
                  );
                } else {
                  setVisiblePanels([
                    ...visiblePanels,
                    TopLevelPanelId.COMMENTS,
                  ]);
                }
              }}
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
              onClick={() => {
                if (visiblePanels.includes(TopLevelPanelId.COMMENTS)) {
                  setVisiblePanels(
                    visiblePanels.filter(
                      (panel) => panel !== TopLevelPanelId.COMMENTS
                    )
                  );
                } else {
                  setVisiblePanels([
                    ...visiblePanels,
                    TopLevelPanelId.COMMENTS,
                  ]);
                }
              }}
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
              onClick={() => {
                if (visiblePanels.includes(TopLevelPanelId.CHAT)) {
                  setVisiblePanels(
                    visiblePanels.filter(
                      (panel) => panel !== TopLevelPanelId.CHAT
                    )
                  );
                } else {
                  setVisiblePanels([...visiblePanels, TopLevelPanelId.CHAT]);
                }
              }}
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
      <PanelGroup id="workspace" direction="horizontal" className="h-full">
        <Panel
          collapsible={true}
          collapsedSize={1}
          ref={fileExplorerPanelRef}
          id={FILE_EXPLORER.id}
          order={1}
          defaultSize={FILE_EXPLORER.defaultSize}
          minSize={FILE_EXPLORER.minSize}
          className={`bg-blue-50 border-r border-blue-200 h-full ${
            visiblePanels.includes(TopLevelPanelId.FILE_EXPLORER)
              ? "w-auto"
              : "w-8"
          }`}
        >
          {visiblePanels.includes(TopLevelPanelId.FILE_EXPLORER) ? (
            <FileExplorer
              files={workspaceFiles}
              onFileSelect={() => {}}
              selectedFile={workspaceFiles[0]}
              onFilesChange={() => {}}
            />
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="w-full p-2"
              onClick={() => {
                setVisiblePanels([
                  ...visiblePanels,
                  TopLevelPanelId.FILE_EXPLORER,
                ]);
                fileExplorerPanelRef.current?.expand();
              }}
            >
              <LayoutDashboard size={16} className="rotate-90" />
            </Button>
          )}
        </Panel>
        <PanelResizeHandle className="w-2 bg-gray-300 hover:bg-blue-400 transition-colors" />
        <Panel
          id={FILE_VIEWER.id}
          order={2}
          defaultSize={FILE_VIEWER.defaultSize}
          minSize={FILE_VIEWER.minSize}
        >
          <PanelGroup id="file-groups" direction="horizontal">
            <Panel id="file-group-1" order={1}>
              <div className="bg-white p-4 border-b border-border">
                <h2 className="text-lg font-semibold text-foreground mb-2">
                  File Tabs
                </h2>
              </div>
              <PanelGroup id="file-group-1-files" direction="horizontal">
                Empty File Group
              </PanelGroup>
            </Panel>
            {fileGroupCount > FileGroupCount.ONE && (
              <>
                <PanelResizeHandle className="w-2 bg-gray-300 hover:bg-blue-400 transition-colors" />
                <Panel id="file-group-2" order={2}>
                  <div className="bg-white p-4 border-b border-border">
                    <h2 className="text-lg font-semibold text-foreground mb-2">
                      File Tabs
                    </h2>
                  </div>
                  <PanelGroup id="file-group-2-files" direction="horizontal">
                    Empty File Group
                  </PanelGroup>
                </Panel>
              </>
            )}
            {fileGroupCount > FileGroupCount.TWO && (
              <>
                <PanelResizeHandle className="w-2 bg-gray-300 hover:bg-blue-400 transition-colors" />
                <Panel id="file-group-3" order={3}>
                  <div className="bg-white p-4 border-b border-border">
                    <h2 className="text-lg font-semibold text-foreground mb-2">
                      File Tabs
                    </h2>
                  </div>
                  <PanelGroup id="file-group-3-files" direction="horizontal">
                    Empty File Group
                  </PanelGroup>
                </Panel>
              </>
            )}
            {fileGroupCount > FileGroupCount.THREE && (
              <>
                <PanelResizeHandle className="w-2 bg-gray-300 hover:bg-blue-400 transition-colors" />
                <Panel id="file-group-4" order={4}>
                  <div className="bg-white p-4 border-b border-border">
                    <h2 className="text-lg font-semibold text-foreground mb-2">
                      File Tabs
                    </h2>
                  </div>
                  <PanelGroup id="file-group-4-files" direction="horizontal">
                    Empty File Group
                  </PanelGroup>
                </Panel>
              </>
            )}
          </PanelGroup>
        </Panel>
        {containsAnyOf(visiblePanels, [
          TopLevelPanelId.COMMENTS,
          TopLevelPanelId.CHAT,
        ]) && (
          <PanelResizeHandle className="w-2 bg-gray-300 hover:bg-blue-400 transition-colors" />
        )}
        {visiblePanels.includes(TopLevelPanelId.COMMENTS) && (
          <Panel
            id={COMMENTS.id}
            order={3}
            defaultSize={COMMENTS.defaultSize}
            minSize={COMMENTS.minSize}
            className="bg-green-50 p-4 border-l border-green-200"
          >
            <h2 className="text-lg font-semibold text-green-800 mb-2">
              Comments Panel
            </h2>
            <p className="text-green-600">Content for the right panel</p>
          </Panel>
        )}
        {containsAllOf(visiblePanels, [
          TopLevelPanelId.COMMENTS,
          TopLevelPanelId.CHAT,
        ]) && (
          <PanelResizeHandle className="w-2 bg-gray-300 hover:bg-blue-400 transition-colors" />
        )}
        {visiblePanels.includes(TopLevelPanelId.CHAT) && (
          <Panel
            id={CHAT.id}
            order={4}
            defaultSize={CHAT.defaultSize}
            minSize={CHAT.minSize}
            className="bg-orange-50 p-4 border-l border-orange-200"
          >
            <h2 className="text-lg font-semibold text-orange-800 mb-2">
              Chat Panel
            </h2>
            <p className="text-orange-600">Content for the right panel</p>
          </Panel>
        )}
      </PanelGroup>
    </div>
  );
}

function containsAnyOf(array: TopLevelPanelId[], panels: TopLevelPanelId[]) {
  return array.some((panel) => panels.includes(panel));
}

function containsAllOf(array: TopLevelPanelId[], panels: TopLevelPanelId[]) {
  return panels.every((panel) => array.includes(panel));
}

const workspaceFiles = [...Array(10).keys()].map((id) => {
  const idStr = (id + 1).toString();
  return {
    id: idStr,
    name: `File ${idStr}`,
    absolutePath: "",
    workspaceId: "",
    appDir: null,
  };
});
