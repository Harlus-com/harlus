import FileExplorer from "@/components/FileExplorer";
import { PanelGroup, Panel } from "react-resizable-panels";
import { useEffect, useRef, useState } from "react";
import PanelDivider from "@/components/PanelDivider";
import WorkspaceHeader from "@/components/WorkspaceHeader";
import FileView from "@/components/FileView";
import { OpenFileGroup } from "@/components/OpenFileGroup";
import {
  TopLevelPanel,
  FileGroupCount,
  TopLevelPanelId,
} from "@/components/panels";
import { useParams, useNavigate } from "react-router-dom";
import { workspaceService } from "@/api/workspaceService";
import { fileService } from "@/api/fileService";
import { WorkspaceFile, Workspace as WorkspaceType } from "@/api/types";
import ChatPanel from "@/components/ChatPanel";
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
  const [workspace, setWorkspace] = useState<WorkspaceType | null>(null);
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const dropAreaRef = useRef<HTMLDivElement>(null);
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
      setWorkspace(workspace);
    };

    loadWorkspace();
  }, [workspaceId, navigate]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (!workspaceId) return;

    const fileStats = await Promise.all(
      Array.from(e.dataTransfer.files).map((file) =>
        // @ts-ignore - Electron specific property
        window.electron.getFileStats(file.path)
      )
    );
    for (const fileStat of fileStats) {
      if (fileStat.isDirectory) {
        fileService.importFolder(fileStat.path, workspaceId);
      }
      if (fileStat.mimeType === "application/pdf") {
        const newFile = await fileService.importFile(
          fileStat.path,
          workspaceId
        );
        console.log("newFile", newFile);
        setFiles((prev) => [...prev, newFile]);
      }
    }
  };

  const [visiblePanels, setVisiblePanels] = useState<TopLevelPanelId[]>([
    TopLevelPanelId.FILE_EXPLORER,
    TopLevelPanelId.FILE_VIEWER,
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
    <div className="flex flex-col h-screen">
      <WorkspaceHeader
        workspace={workspace}
        onFileGroupCountChange={handleOnFileGroupCountChange}
        togglePanelVisibility={togglePanelVisibility}
        openContrastAnalysis={openContrastAnalysis}
        refreshFiles={refreshFiles}
      />
      <PanelGroup id="workspace" direction="horizontal" className="flex-1">
        <div
          className="flex-1 flex overflow-hidden"
          ref={dropAreaRef}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isDragging && (
            <div className="absolute inset-0 bg-black/20 flex items-center justify-center backdrop-blur-sm">
              <div className="bg-card p-8 rounded-lg shadow-lg text-center">
                <div className="text-4xl mb-4">📄</div>
                <div className="text-xl font-medium">Drop PDFs here</div>
                <div className="text-muted-foreground mt-2">
                  Files will be added to your workspace
                </div>
              </div>
            </div>
          )}
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
                onFilesChange={setFiles}
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
            >
              <ChatPanel
                onSourceClicked={(file) =>
                  handleFileSelect(file, FileGroupCount.ONE)
                }
              />
            </Panel>
          )}
        </div>
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
