import FileExplorer from "@/components/FileExplorer";
import { PanelGroup, Panel } from "react-resizable-panels";
import { useEffect, useState } from "react";
import PanelDivider from "@/components/PanelDivider";
import WorkspaceHeader from "@/components/WorkspaceHeader";
import FileView, { OpenFileGroup } from "@/components/FileView";
import {
  TopLevelPanel,
  FileGroupCount,
  TopLevelPanelId,
} from "@/components/panels";
import { useParams, useNavigate } from "react-router-dom";
import { workspaceService } from "@/api/workspaceService";
import { fileService } from "@/api/fileService";
import { WorkspaceFile } from "@/api/types";
// The default sizes scale relative to each other.
// They work best when the sum of all the default sizes is 100.
// If one of the panels is not visible, they will be "resacled" to add up to 100.
const FILE_EXPLORER = new TopLevelPanel(TopLevelPanelId.FILE_EXPLORER, 15);
const FILE_VIEWER = new TopLevelPanel(TopLevelPanelId.FILE_VIEWER, 50);
const COMMENTS = new TopLevelPanel(TopLevelPanelId.COMMENTS, 15);
const CHAT = new TopLevelPanel(TopLevelPanelId.CHAT, 20);

export default function Workspace() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  useEffect(() => {
    const loadWorkspace = async () => {
      if (!workspaceId) {
        navigate("/");
        return;
      }

      const workspace = await workspaceService.getWorkspace(workspaceId);
      if (!workspace) {
        navigate("/");
        return;
      }

      const workspaceFiles = await fileService.getFiles(workspaceId);
      setFiles(workspaceFiles);
      handleFileSelect(workspaceFiles[0], FileGroupCount.ONE);
    };

    loadWorkspace();
  }, [workspaceId, navigate]);
  const [visiblePanels, setVisiblePanels] = useState<TopLevelPanelId[]>([
    TopLevelPanelId.FILE_EXPLORER,
    TopLevelPanelId.FILE_VIEWER,
    TopLevelPanelId.COMMENTS,
    TopLevelPanelId.CHAT,
  ]);
  const [openFiles, setOpenFiles] = useState<
    Record<FileGroupCount, OpenFileGroup | null>
  >({
    [FileGroupCount.ONE]: OpenFileGroup.empty(),
    [FileGroupCount.TWO]: null,
    [FileGroupCount.THREE]: null,
    [FileGroupCount.FOUR]: null,
  });
  const handleOnFileGroupCountChange = (count: FileGroupCount) => {
    const updates: Record<FileGroupCount, OpenFileGroup | null> = {
      [FileGroupCount.ONE]: null,
      [FileGroupCount.TWO]: null,
      [FileGroupCount.THREE]: null,
      [FileGroupCount.FOUR]: null,
    };
    for (let group = 1; group <= FileGroupCount.FOUR; group++) {
      if (group > count) {
        updates[group] = null;
      } else {
        if (openFiles[group] == null) {
          updates[group] = OpenFileGroup.empty();
        } else {
          updates[group] = openFiles[group];
        }
      }
    }
    setOpenFiles(() => updates);
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

  const refreshFiles = async () => {
    if (!workspaceId) return;

    try {
      const workspaceFiles = await fileService.getFiles(workspaceId);
      setFiles(workspaceFiles);
    } catch (error) {
      console.error("Failed to refresh workspace:", error);
    }
  };

  const handleFileSelect = (
    file: WorkspaceFile,
    groupNumber: FileGroupCount
  ) => {
    console.log("handleFileSelect", file, groupNumber);
    const current = openFiles[groupNumber];
    const updates = {};
    if (current == null) {
      updates[groupNumber] = OpenFileGroup.empty().addFile(file, {
        select: true,
      });
    } else {
      updates[groupNumber] = current.addFile(file, { select: true });
    }
    setOpenFiles((prev) => ({
      ...prev,
      ...updates,
    }));
  };

  return (
    <div className="h-screen">
      <WorkspaceHeader
        onFileGroupCountChange={handleOnFileGroupCountChange}
        togglePanelVisibility={togglePanelVisibility}
        openContrastAnalysis={openContrastAnalysis}
        refreshFiles={refreshFiles}
      />
      <PanelGroup id="workspace" direction="horizontal" className="h-full">
        {visiblePanels.includes(TopLevelPanelId.FILE_EXPLORER) && (
          <Panel
            id={FILE_EXPLORER.id}
            order={1}
            defaultSize={FILE_EXPLORER.defaultSize}
            minSize={FILE_EXPLORER.minSize}
            className="bg-blue-50 h-full w-auto"
          >
            <FileExplorer
              files={files}
              onFileSelect={handleFileSelect}
              openFiles={openFiles}
            />
          </Panel>
        )}
        <PanelDivider />
        <Panel
          id={FILE_VIEWER.id}
          order={2}
          defaultSize={FILE_VIEWER.defaultSize}
          minSize={FILE_VIEWER.minSize}
        >
          <FileView openFiles={openFiles} setOpenFiles={setOpenFiles} />
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
