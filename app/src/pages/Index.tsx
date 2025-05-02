import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import PdfViewer, { PdfViewerRef } from "@/components/ReactPdfViewer";
import ChatPanel from "@/components/ChatPanel";
import ContrastAnalysisPanel, {
  ContrastResult,
} from "@/components/ContrastAnalysisPanel";
import WorkspaceEventListener from "@/components/WorkspaceEventListener";
import CommentsThread from "@/components/CommentsThread";
import { Button } from "@/components/ui/button";
import { SyncStatus, WorkspaceFile } from "@/api/types";
import { fileService } from "@/api/fileService";
import { workspaceService } from "@/api/workspaceService";
import {
  MessageSquare,
  FileSearch,
  Maximize,
  Minimize,
  RefreshCw,
  MessageCircle,
} from "lucide-react";
import { LayoutDashboard } from "lucide-react";
import { modelService } from "@/api/model_service";

// Add a type for the knowledge graph status
type KnowledgeGraphStatus = "Up to Date" | "Out of Date" | "Building...";

const Index = () => {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState<any>(null);
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<WorkspaceFile | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [leftWidth, setLeftWidth] = useState(300);
  const [rightWidth, setRightWidth] = useState(400);
  const [knowledgeGraphStatus, setKnowledgeGraphStatus] =
    useState<KnowledgeGraphStatus>("Up to Date");
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const dropAreaRef = useRef<HTMLDivElement>(null);
  const minSidebar = 200;
  const maxSidebar = 600;
  const minChatPanel = 300;
  const maxChatPanel = 600;
  const pdfViewerRef = useRef<PdfViewerRef>(null);

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

      setWorkspace(workspace);
      const workspaceFiles = await fileService.getFiles(workspaceId);
      setFiles(workspaceFiles);

      checkKnowledgeGraphStatus();
    };

    loadWorkspace();
  }, [workspaceId, navigate]);

  const handleWorkspaceStatusChange = useCallback((status: string) => {
    if (status === "SYNC_COMPLETE") {
      setKnowledgeGraphStatus("Up to Date");
    } else if (status === "SYNC_IN_PROGRESS") {
      setKnowledgeGraphStatus("Building...");
    } else {
      setKnowledgeGraphStatus("Out of Date");
    }
  }, []);

  const handleFileStatusChange = useCallback(
    (fileId: string, status: SyncStatus) => {
      console.log("handleFileStatusChange", fileId, status);
      setFiles((prev) =>
        prev.map((file) => (file.id === fileId ? { ...file, status } : file))
      );
    },
    []
  );

  // Function to check knowledge graph status
  const checkKnowledgeGraphStatus = async () => {
    const status = await modelService.getSyncStatus(workspaceId);
    handleWorkspaceStatusChange(status);
  };

  // Function to update knowledge graph
  const updateKnowledgeGraph = async () => {
    setKnowledgeGraphStatus("Building...");
    await modelService.updateKnowledgeGraph(workspaceId);
  };

  // Handle file selection
  const handleFileSelect = (file: WorkspaceFile) => {
    console.log("handleFileSelect", file);
    setSelectedFile(file);
  };

  // Handle drag and drop events
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
        // Select the first new file
        setSelectedFile(newFile);
      }
    }
  };

  // Handle open file dialog
  const handleOpenFileDialog = async () => {
    if (!workspaceId) return;
  };

  // Toggle panels
  const toggleComments = () => {
    setIsCommentsOpen((prev) => !prev);
  };

  const toggleChat = () => {
    setIsChatOpen((prev) => !prev);
  };

  const toggleAnalysis = () => {
    setIsAnalysisOpen((prev) => !prev);
    if (isChatOpen) setIsChatOpen(false);
    if (isCommentsOpen) setIsCommentsOpen(false);
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Add the WorkspaceEventListener component */}
      <WorkspaceEventListener
        onStatusChange={handleWorkspaceStatusChange}
        onFileStatusChange={handleFileStatusChange}
      />

      <header className="border-b border-border p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold">
            {workspace?.ticker} - {workspace?.name}
          </h1>
          <Button variant="outline" size="sm" onClick={() => navigate("/")}>
            <LayoutDashboard className="mr-2" size={16} />
            Switch Workspace
          </Button>

          {/* Knowledge Graph Status Indicator */}
          <div className="flex items-center gap-2 ml-4">
            <span className="text-sm font-medium">Knowledge Graph:</span>
            <span
              className={`text-sm ${
                knowledgeGraphStatus === "Up to Date"
                  ? "text-green-600"
                  : knowledgeGraphStatus === "Building..."
                  ? "text-amber-600"
                  : "text-red-600"
              }`}
            >
              {knowledgeGraphStatus}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={updateKnowledgeGraph}
              className="ml-2"
            >
              <RefreshCw className="mr-1" size={14} />
              Update
            </Button>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={handleOpenFileDialog} variant="outline" size="sm">
            Open Files
          </Button>
          <Button
            onClick={toggleComments}
            variant={isCommentsOpen ? "default" : "outline"}
            size="sm"
          >
            <MessageCircle size={16} className="mr-1" />
            {isCommentsOpen ? <Minimize size={14} /> : <Maximize size={14} />}
          </Button>
          <Button
            onClick={toggleChat}
            variant={isChatOpen ? "default" : "outline"}
            size="sm"
          >
            <MessageSquare size={16} className="mr-1" />
            {isChatOpen ? <Minimize size={14} /> : <Maximize size={14} />}
          </Button>
          <Button
            onClick={toggleAnalysis}
            variant={isAnalysisOpen ? "default" : "outline"}
            size="sm"
          >
            <FileSearch size={16} className="mr-1" />
            {isAnalysisOpen ? <Minimize size={14} /> : <Maximize size={14} />}
          </Button>
        </div>
      </header>

      <div
        className="flex-1 flex overflow-hidden"
        ref={dropAreaRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div
          className="bg-gray-100 overflow-auto resize-x"
          style={{
            width: `${leftWidth}px`,
            minWidth: `${minSidebar}px`,
            maxWidth: `${maxSidebar}px`,
          }}
        >
          <Sidebar
            files={files}
            onFileSelect={handleFileSelect}
            selectedFile={selectedFile}
            onFilesChange={setFiles}
          />
        </div>

        {/* Drag handle for Area 1 */}
        <div
          className="w-2 cursor-col-resize bg-gray-300 hover:bg-gray-400"
          onMouseDown={(e) => startDrag(e, "left")}
        />

        <div className="flex-1 bg-white">
          <div className="h-full">
            <PdfViewer
              file={selectedFile}
              key={selectedFile?.id}
              ref={pdfViewerRef}
            />
          </div>

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
        </div>

        {/* Comments Panel */}
        {isCommentsOpen && (
          <>
            <div
              className="w-2 cursor-col-resize bg-gray-300 hover:bg-gray-400"
              onMouseDown={(e) => startDrag(e, "comments")}
            />
            <div
              className="bg-gray-100 overflow-auto resize-x"
              style={{
                width: `${rightWidth}px`,
                minWidth: `${minSidebar}px`,
                maxWidth: `${maxSidebar}px`,
              }}
            >
              <CommentsThread pdfViewerRef={pdfViewerRef} comments={[]} />
            </div>
          </>
        )}

        {/* Chat Panel */}
        {isChatOpen && (
          <>
            <div
              className="w-2 cursor-col-resize bg-gray-300 hover:bg-gray-400"
              onMouseDown={(e) => startDrag(e, "chat")}
            />
            <div
              className="bg-gray-100 overflow-auto resize-x"
              style={{
                width: `${rightWidth}px`,
                minWidth: `${minSidebar}px`,
                maxWidth: `${maxSidebar}px`,
              }}
            >
              <ChatPanel onSourceClicked={handleFileSelect} />
            </div>
          </>
        )}

        <ContrastAnalysisPanel
          files={files}
          isOpen={isAnalysisOpen}
          onClose={() => setIsAnalysisOpen(false)}
          onContrastAnalysisResult={handleContrastAnalysisResult}
        />
      </div>
    </div>
  );

  function handleContrastAnalysisResult(result: ContrastResult) {
    console.log("handleContrastAnalysisResult", result);
    const file = files.find((file) => file.id === result.fileId);
    file.annotations = {
      show: true,
      data: result.claimChecks,
    };
    handleFileSelect(file);
  }

  function startDrag(
    e: React.MouseEvent,
    side: "left" | "right" | "comments" | "chat"
  ) {
    e.preventDefault();
    const startX = e.clientX;

    let startWidth;
    if (side === "left") {
      startWidth = leftWidth;
    } else if (side === "right") {
      startWidth = rightWidth;
    } else if (side === "comments") {
      startWidth = rightWidth;
    } else if (side === "chat") {
      startWidth = rightWidth;
    }

    function onMouseMove(ev: MouseEvent) {
      const delta = ev.clientX - startX;
      if (side === "left") {
        setLeftWidth(
          Math.min(Math.max(startWidth + delta, minSidebar), maxSidebar)
        );
      } else if (side === "right") {
        setRightWidth(
          Math.min(Math.max(startWidth - delta, minChatPanel), maxChatPanel)
        );
      } else if (side === "comments" || side === "chat") {
        setRightWidth(
          Math.min(Math.max(startWidth - delta, minChatPanel), maxChatPanel)
        );
      }
    }

    function onMouseUp() {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }
};

export default Index;
