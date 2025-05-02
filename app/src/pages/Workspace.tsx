import FileExplorer from "@/components/FileExplorer";
import {
  PanelGroup,
  Panel,
  ImperativePanelHandle,
} from "react-resizable-panels";
import { useRef, useState } from "react";
import PanelDivider from "@/components/PanelDivider";
import WorkspaceHeader from "@/components/WorkspaceHeader";
import FileView, { OpenFileGroup } from "@/components/FileView";
import {
  TopLevelPanel,
  FileGroupCount,
  TopLevelPanelId,
} from "@/components/panels";

// The default sizes scale relative to each other.
// They work best when the sum of all the default sizes is 100.
// If one of the panels is not visible, they will be "resacled" to add up to 100.
const FILE_EXPLORER = new TopLevelPanel(TopLevelPanelId.FILE_EXPLORER, 15);
const FILE_VIEWER = new TopLevelPanel(TopLevelPanelId.FILE_VIEWER, 50);
const COMMENTS = new TopLevelPanel(TopLevelPanelId.COMMENTS, 15);
const CHAT = new TopLevelPanel(TopLevelPanelId.CHAT, 20);

export default function Workspace() {
  const [visiblePanels, setVisiblePanels] = useState<TopLevelPanelId[]>([
    TopLevelPanelId.FILE_EXPLORER,
    TopLevelPanelId.FILE_VIEWER,
    TopLevelPanelId.COMMENTS,
    TopLevelPanelId.CHAT,
  ]);
  const [openFiles, setOpenFiles] = useState<
    Record<FileGroupCount, OpenFileGroup>
  >({
    [FileGroupCount.ONE]: {
      files: [],
      selectedFile: null,
    },
    [FileGroupCount.TWO]: null,
    [FileGroupCount.THREE]: null,
    [FileGroupCount.FOUR]: null,
  });
  const handleOnFileGroupCountChange = (count: FileGroupCount) => {
    console.log("handleOnFileGroupCountChange", count);
    const updates: Record<FileGroupCount, OpenFileGroup | null> = {
      [FileGroupCount.ONE]: null,
      [FileGroupCount.TWO]: null,
      [FileGroupCount.THREE]: null,
      [FileGroupCount.FOUR]: null,
    };

    for (let group = 1; group <= FileGroupCount.FOUR; group++) {
      if (group > count) {
        console.log("group > count", group);
        updates[group] = null;
      } else {
        console.log("group <= count", group);
        if (openFiles[group] == null) {
          console.log("openFiles[group] == null", group);
          updates[group] = {
            files: [],
            selectedFile: null,
          };
        } else {
          console.log("openFiles[group] != null", group);
          updates[group] = openFiles[group];
        }
      }
    }
    console.log("updates", updates);
    setOpenFiles((prev) => ({
      ...prev,
      ...updates,
    }));
  };

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
        onFileGroupCountChange={handleOnFileGroupCountChange}
        togglePanelVisibility={togglePanelVisibility}
        openContrastAnalysis={openContrastAnalysis}
        refreshSyncStatus={refreshSyncStatus}
      />
      <PanelGroup id="workspace" direction="horizontal" className="h-full">
        <Panel
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
          {visiblePanels.includes(TopLevelPanelId.FILE_EXPLORER) && (
            <FileExplorer
              files={workspaceFiles}
              onFileSelect={() => {}}
              selectedFile={workspaceFiles[0]}
              onFilesChange={() => {}}
            />
          )}
        </Panel>
        <PanelDivider />
        <Panel
          id={FILE_VIEWER.id}
          order={2}
          defaultSize={FILE_VIEWER.defaultSize}
          minSize={FILE_VIEWER.minSize}
        >
          <FileView openFiles={openFiles} />
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
