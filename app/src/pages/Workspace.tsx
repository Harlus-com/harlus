import { fileService } from "@/api/fileService";
import {
  WorkspaceFile,
  Workspace as WorkspaceType,
  Folder,
} from "@/api/workspace_types";
import { workspaceService } from "@/api/workspaceService";
import { CommentsProvider } from "@/comments/CommentsProvider";
import ChatPanel from "@/chat/ChatPanel";
import FileExplorer from "@/components/FileExplorer";
import FileView from "@/components/FileView";
import { OpenFileGroup } from "@/components/OpenFileGroup";
import PanelDivider from "@/components/PanelDivider";
import {
  FileGroupCount,
  TopLevelPanel,
  TopLevelPanelId,
} from "@/components/panels";
import WorkspaceHeader from "@/components/WorkspaceHeader";
import { useEffect, useRef, useState, useCallback, useLayoutEffect } from "react";
import { Panel, PanelGroup, ImperativePanelGroupHandle } from "react-resizable-panels";
import { useNavigate, useParams } from "react-router-dom";
import { ChatThreadProvider } from "@/chat/ChatThreadContext";
import { useComments } from "@/comments/useComments";

// The default sizes scale relative to each other.
// They work best when the sum of all the default sizes is 100.
// If one of the panels is not visible, they will be "resacled" to add up to 100.
const FILE_EXPLORER = new TopLevelPanel(TopLevelPanelId.FILE_EXPLORER, 10);
const FILE_VIEWER   = new TopLevelPanel(TopLevelPanelId.FILE_VIEWER, 75);
const CHAT          = new TopLevelPanel(TopLevelPanelId.CHAT, 15);

const LAYOUT_TWO_PANELS   = [10, 90] as const;    // explorer | chat
const LAYOUT_THREE_PANELS = [10, 75, 15] as const; // explorer | viewer | chat

export default function Workspace() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState<WorkspaceType | null>(null);
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const dropAreaRef = useRef<HTMLDivElement>(null);
  const panelGroupRef = useRef<ImperativePanelGroupHandle>(null);
  const [chatSendMessage, setChatSendMessage] = useState<(message: string) => void>();
  const [chatPanelFunctions, setChatPanelFunctions] = useState<{
    setInput?: (message: string) => void;
    sendMessage?: () => void;
  }>({});
  
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
    const workspaceFolders = await fileService.getFolders(workspaceId);
    
    // Set all files to SYNC_COMPLETE
    const syncedFiles = workspaceFiles.map(file => ({
      ...file,
      status: "SYNC_COMPLETE" as const
    }));

    setFiles(syncedFiles);
    setFolders(workspaceFolders);
    setWorkspace(workspace);
  };

  //const setPanelWidths = (widths: { fileExplorer?: number; fileViewer?: number; chat?: number }) => {
  //  if (panelGroupRef.current) {
  //    panelGroupRef.current.setLayout([widths.fileExplorer || 15, widths.fileViewer || 70, widths.chat || 15]);
  //  }
  //}; 

  useEffect(() => {
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
    TopLevelPanelId.CHAT,
  ]);
  useLayoutEffect(() => {
    if (!panelGroupRef.current) return;
  
    const sizes = visiblePanels.includes(TopLevelPanelId.FILE_VIEWER)
      ? LAYOUT_THREE_PANELS
      : LAYOUT_TWO_PANELS;
  
    panelGroupRef.current.setLayout(sizes);   // push the numbers to the library
  }, [visiblePanels]);

  const [openFiles, setOpenFiles] = useState<
    Record<FileGroupCount, OpenFileGroup | null>
  >({
    [FileGroupCount.ONE]: OpenFileGroup.empty(),
    [FileGroupCount.TWO]: null,
    [FileGroupCount.THREE]: null,
    [FileGroupCount.FOUR]: null,
  });
  const handleOnFileGroupCountChange =   (count: FileGroupCount) => {
    const next: Record<FileGroupCount, OpenFileGroup | null> = {
      [FileGroupCount.ONE]:   null,
      [FileGroupCount.TWO]:   null,
      [FileGroupCount.THREE]: null,
      [FileGroupCount.FOUR]:  null,
    };
  
    for (let g = FileGroupCount.ONE; g <= FileGroupCount.FOUR; g++) {
      next[g] = g <= count ? (openFiles[g] ?? OpenFileGroup.empty()) : null;
    }
  
    setOpenFiles(() => next);
  };

  const togglePanelVisibility = (panelId: TopLevelPanelId) => {
    setVisiblePanels((prev) =>
      prev.includes(panelId)
        ? prev.filter((id) => id !== panelId)
        : [...prev, panelId]
    );
  };

  const reloadWorkspace = async () => {
    if (!workspaceId) return;
    window.location.reload();
  };

  const sendPdfMessage = useCallback((message: string) => {
    //if (chatPanelFunctions.setInput && chatPanelFunctions.sendMessage) {
      //chatPanelFunctions.setInput(message);
    chatPanelFunctions.sendMessage?.(message);
    //}
  }, [chatPanelFunctions]);

  const handleFileSelect = (
    file: WorkspaceFile,
    groupNumber: FileGroupCount,
    options: { showComments: boolean }
  ) => {
    // First, ensure the File Viewer panel is visible
    if (!visiblePanels.includes(TopLevelPanelId.FILE_VIEWER)) {
      setVisiblePanels(prev => [...prev, TopLevelPanelId.FILE_VIEWER]);
    }
    // Handle file selection
    const current = openFiles[groupNumber];
    const updates = {};
    if (current == null) {
      updates[groupNumber] = OpenFileGroup.empty().addFile(file, {
        select: true,
        showComments: options.showComments,
      });
    } else {
      updates[groupNumber] = current.addFile(file, {
        select: true,
        showComments: options.showComments,
      });
    }
    setOpenFiles((prev) => ({
      ...prev,
      ...updates,
    }));
  };

  const openFile = useCallback(
    (
      file: WorkspaceFile,
      opts: { showComments: boolean } = { showComments: false }
    ) => handleFileSelect(file, FileGroupCount.ONE, opts),
    [handleFileSelect]
  );

// Hide viewer when the last file is closed
useEffect(() => {
  const allFilesClosed = Object.values(openFiles).every(
    group =>
      group === null ||
      (group.selectedFile === null && Object.keys(group.files).length === 0)
  );

  if (allFilesClosed && visiblePanels.includes(TopLevelPanelId.FILE_VIEWER)) {
    setVisiblePanels(prev =>
      prev.filter(id => id !== TopLevelPanelId.FILE_VIEWER)
    );
  }
}, [openFiles, visiblePanels]);

  return (
    <ChatThreadProvider workspaceId={workspaceId!}>
      <CommentsProvider>
        <div className="flex flex-col h-screen">
          <WorkspaceHeader
            workspace={workspace}
            files={files}
            onFileGroupCountChange={handleOnFileGroupCountChange}
            togglePanelVisibility={togglePanelVisibility}
            openFile={openFile}
            reloadWorkspace={reloadWorkspace}
          />
          <PanelGroup ref={panelGroupRef} id="workspace" direction="horizontal" className="flex-1">
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
                    folders={folders}
                    onFileSelect={(file, groupNumber) =>
                      handleFileSelect(file, groupNumber, {
                        showComments: false,
                      })
                    }
                    openFiles={openFiles}
                    onFilesChange={setFiles}
                    onFoldersChange={setFolders}
                  />
                </Panel>
              )}
              {visiblePanels.includes(TopLevelPanelId.FILE_EXPLORER) && <PanelDivider />}
              {visiblePanels.includes(TopLevelPanelId.FILE_VIEWER) && (
                <Panel
                  id={FILE_VIEWER.id}
                  order={2}
                  defaultSize={FILE_VIEWER.defaultSize}
                  minSize={FILE_VIEWER.minSize}
                >
                  <FileView
                    openFiles={openFiles}
                    setOpenFiles={setOpenFiles}
                    onSendMessage={sendPdfMessage}
                  />
                </Panel>
              )}
              {visiblePanels.includes(TopLevelPanelId.FILE_VIEWER) && <PanelDivider />}
              {visiblePanels.includes(TopLevelPanelId.CHAT) && (
                <Panel
                  id={CHAT.id}
                  order={4}
                  defaultSize={CHAT.defaultSize}
                  minSize={CHAT.minSize}
                >
                  <ChatPanel
                    onSourceClicked={(file) =>
                      handleFileSelect(file, FileGroupCount.ONE, {
                        showComments: true,
                      })
                    }
                    onSendMessageRef={(setInput, sendMessage) => {
                      setChatPanelFunctions({ setInput, sendMessage });
                    }}
                  />
                </Panel>
              )}
            </div>
          </PanelGroup>
        </div>
      </CommentsProvider>
    </ChatThreadProvider>
  );
}
