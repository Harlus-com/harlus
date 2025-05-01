import { FileSearch } from "lucide-react";
import { Maximize } from "lucide-react";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, MessageCircle, LayoutGrid } from "lucide-react";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";
import { useState } from "react";
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

  return (
    <div className="h-screen">
      <header className="border-b border-border p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold">APPL</h1>
          <Button variant="outline" size="sm" onClick={() => {}}>
            <LayoutDashboard className="mr-2" size={16} />
            Switch Workspace
          </Button>

          {/* Knowledge Graph Status Indicator */}
          <div className="flex items-center gap-2 ml-4">
            <span className="text-sm font-medium">Knowledge Graph:</span>
            <span className="text-sm text-green-600">Up to Date</span>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <LayoutGrid size={16} />
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
                setVisiblePanels([...visiblePanels, TopLevelPanelId.COMMENTS]);
              }
            }}
            variant="outline"
            size="sm"
          >
            <MessageCircle size={16} className="mr-1" />
            <Maximize size={14} />
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
          >
            <MessageSquare size={16} className="mr-1" />
            <Maximize size={14} />
          </Button>
          <Button onClick={() => {}} variant="outline" size="sm">
            <FileSearch size={16} className="mr-1" />
            <Maximize size={14} />
          </Button>
        </div>
      </header>
      <PanelGroup id="workspace" direction="horizontal" className="h-full">
        <Panel
          id={FILE_EXPLORER.id}
          order={1}
          defaultSize={FILE_EXPLORER.defaultSize}
          minSize={FILE_EXPLORER.minSize}
          className="bg-blue-50 p-4 border-r border-blue-200 h-full"
        >
          <h2 className="text-lg font-semibold text-blue-800 mb-2">
            File Explorer
          </h2>
          <p className="text-blue-600">Content for the left panel</p>
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
