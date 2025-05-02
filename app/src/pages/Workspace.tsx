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
  ImperativePanelHandle,
} from "react-resizable-panels";
import { useRef, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import PanelDivider from "@/components/PanelDivider";
import WorkspaceHeader from "@/components/WorkspaceHeader";

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

  const togglePanelVisibility = (panelId: TopLevelPanelId) => {
    setVisiblePanels((prev) =>
      prev.includes(panelId)
        ? prev.filter((id) => id !== panelId)
        : [...prev, panelId]
    );
  };

  const openContrastAnalysis = () => {
    console.log("openContrastAnalysis");
  };

  const refreshSyncStatus = () => {
    console.log("refreshSyncStatus");
  };

  return (
    <div className="h-screen">
      <WorkspaceHeader
        onFileGroupCountChange={setFileGroupCount}
        togglePanelVisibility={togglePanelVisibility}
        openContrastAnalysis={openContrastAnalysis}
        refreshSyncStatus={refreshSyncStatus}
      />
      <PanelGroup id="workspace" direction="horizontal" className="h-full">
        <Panel
          collapsible={true}
          collapsedSize={1}
          ref={fileExplorerPanelRef}
          id={FILE_EXPLORER.id}
          order={1}
          defaultSize={FILE_EXPLORER.defaultSize}
          minSize={FILE_EXPLORER.minSize}
          className={`bg-blue-50  h-full ${
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
        <PanelDivider />
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
                <PanelDivider />
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
                <PanelDivider />
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
                <PanelDivider />
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
        ]) && <PanelDivider />}
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
        ]) && <PanelDivider />}
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
