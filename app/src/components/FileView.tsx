import React, { useEffect, useRef, useState } from "react";
import { PanelGroup, Panel } from "react-resizable-panels";
import { FileGroupCount } from "./panels";
import PanelDivider from "./PanelDivider";
import { WorkspaceFile } from "@/api/workspace_types";
import PdfViewer from "@/components/ReactPdfViewer";
import { OpenFileGroup } from "./OpenFileGroup";
import { MessageSquareQuote } from "lucide-react";
import { Button } from "@/components/ui/button";
import CommentsThread from "../comments/CommentsThread";
import { fileService } from "@/api/fileService";
import ExcelViewer from "@/components/ExcelViewer";
import DocxViewer from "@/components/DocxViewer";

export interface FileViewProps {
  openFiles: Record<FileGroupCount, OpenFileGroup | null>;
  setOpenFiles: React.Dispatch<
    React.SetStateAction<Record<FileGroupCount, OpenFileGroup | null>>
  >;
  onSendMessage?: (message: string) => void;
}

export default function FileView({ openFiles, setOpenFiles, onSendMessage }: FileViewProps) {
  const fileGroupCount = Object.values(openFiles).filter((g) => g).length;

  const handleSelectFile = (
    groupIndex: FileGroupCount,
    file: WorkspaceFile
  ) => {
    const group = openFiles[groupIndex] || OpenFileGroup.empty();
    setOpenFiles((prev) => {
      return {
        ...prev,
        [groupIndex]: group.setSelectedFile(file),
      };
    });
  };

  const handleCloseFile = (groupIndex: FileGroupCount, fileId: string) => {
    const group = openFiles[groupIndex] || OpenFileGroup.empty();
    setOpenFiles((prev) => {
      return {
        ...prev,
        [groupIndex]: group.removeFile(fileId),
      };
    });
  };

  const handleToggleComments = (groupIndex: FileGroupCount, fileId: string) => {
    const group = openFiles[groupIndex] || OpenFileGroup.empty();
    setOpenFiles((prev) => {
      return { ...prev, [groupIndex]: group.toggleShowComments(fileId) };
    });
  };

  const openFile = async (
    fileId: string,
    options: {
      showComments: boolean;
      fileGroup: FileGroupCount;
      initialPage?: number;
    }
  ) => {
    const current = openFiles[options.fileGroup] || OpenFileGroup.empty();
    const file = await fileService.getFileFromId(fileId);
    const updates = {};
    if (current == null) {
      updates[options.fileGroup] = OpenFileGroup.empty().addFile(file, {
        select: true,
        showComments: options.showComments,
        initialPage: options.initialPage,
      });
    } else {
      updates[options.fileGroup] = current.addFile(file, {
        select: true,
        showComments: options.showComments,
        initialPage: options.initialPage,
      });
    }
    setOpenFiles((prev) => ({
      ...prev,
      ...updates,
    }));
  };

  const makeFileGroup = (
    groupIndex: FileGroupCount,
    options: { panelDivider: boolean } = { panelDivider: true }
  ) => {
    if (!openFiles[groupIndex]) return null;

    return (
      <>
        {options.panelDivider && <PanelDivider />}
        <FileGroupPanel
          key={groupIndex}
          openFileGroup={openFiles[groupIndex]!}
          groupIndex={groupIndex}
          onSelectFile={handleSelectFile}
          onCloseFile={handleCloseFile}
          onToggleComments={handleToggleComments}
          openFile={openFile}
          onSendMessage={onSendMessage}
        />
      </>
    );
  };

  return (
    <PanelGroup id="file-groups" direction="horizontal">
      {makeFileGroup(FileGroupCount.ONE, { panelDivider: false })}

      {fileGroupCount > FileGroupCount.ONE && makeFileGroup(FileGroupCount.TWO)}

      {fileGroupCount > FileGroupCount.TWO &&
        makeFileGroup(FileGroupCount.THREE)}

      {fileGroupCount > FileGroupCount.THREE &&
        makeFileGroup(FileGroupCount.FOUR)}
    </PanelGroup>
  );
}

interface FileGroupPanelProps {
  openFileGroup: OpenFileGroup;
  groupIndex: FileGroupCount;
  onSelectFile: (group: FileGroupCount, file: WorkspaceFile) => void;
  onCloseFile: (group: FileGroupCount, fileId: string) => void;
  onToggleComments: (group: FileGroupCount, fileId: string) => void;
  openFile: (
    fileId: string,
    options: {
      showComments: boolean;
      jumpToSelectedComment: boolean;
      fileGroup: FileGroupCount;
      initialPage?: number;
    }
  ) => void;
  onSendMessage?: (message: string) => void;
}

function FileGroupPanel({
  openFileGroup,
  groupIndex,
  onSelectFile,
  onCloseFile,
  onToggleComments,
  openFile,
  onSendMessage,
}: FileGroupPanelProps) {
  const { files, selectedFile, showComments } = openFileGroup;

  return (
    <Panel
      id={`file-group-${groupIndex}`}
      order={1}
      className="flex flex-col h-full min-h-0"
    >
      {selectedFile != null && (
        <div className="bg-white border-b border-border">
          <div className="flex items-center justify-between border-b border-gray-200">
            <div className="flex space-x-1">
              {Object.values(files).map((file) => {
                const isActive = selectedFile?.id === file.id;
                return (
                  <div
                    key={file.id}
                    className={`flex items-center -mb-px border-b-2 ${
                      isActive
                        ? "border-blue-500"
                        : "border-transparent hover:border-gray-300"
                    }`}
                  >
                    <button
                      onClick={() => onSelectFile(groupIndex, file)}
                      className={`px-3 py-1 text-sm font-medium focus:outline-none ${
                        isActive
                          ? "text-blue-600"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      {file.name}
                    </button>
                    <button
                      onClick={() => onCloseFile(groupIndex, file.id)}
                      className="ml-1 text-gray-400 hover:text-gray-600 text-xs focus:outline-none"
                      aria-label={`Close ${file.name}`}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
            <Button
              onClick={() => onToggleComments(groupIndex, selectedFile.id)}
              variant="ghost"
              size="sm"
              className="group relative"
            >
              <MessageSquareQuote size={16} />
              <div className="absolute top-full right-0 mt-1 px-2 py-1 text-xs bg-popover text-popover-foreground rounded-md shadow-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                Toggle Comments
              </div>
            </Button>
          </div>
        </div>
      )}
      {/* TODO: Autosave per file */}
      <PanelGroup id={`file-group-${groupIndex}-viewer`} direction="horizontal">
        <Panel
          id={`file-group-${groupIndex}-file`}
          order={1}
          defaultSize={80}
          className="flex flex-col h-full min-h-0 overflow-auto"
        >
          {selectedFile != null ? (
            <div className="flex-1 min-h-0">
              {(() => {
                // Extract file extension
                const fileExt = selectedFile.name.split('.').pop()?.toLowerCase();
                
                // Choose viewer based on file extension
                switch (fileExt) {
                  case 'xls':
                  case 'xlsx':
                    return <ExcelViewer key="excel-viewer"/>;
                  case 'doc':
                  case 'docx':
                    return <DocxViewer key="doc-viewer"/>;
                  case 'pdf':
                  default:
                    return (
                      <PdfViewer 
                        file={selectedFile} 
                        key={selectedFile.id}
                        initialPage={openFileGroup.initialPages[selectedFile.id] ?? 0}
                        onSendMessage={onSendMessage}
                      />
                    );
                }
              })()}
            </div>
          ) : (
            <div className="flex-1 bg-white h-full flex items-center justify-center">
              Empty File Group
            </div>
          )}
        </Panel>
        {selectedFile != null && showComments[selectedFile.id] && (
          <>
            <PanelDivider invisible={true} />
            <Panel
              id={`file-group-${groupIndex}-comments`}
              order={2}
              minSize={30}
              maxSize={30}
              defaultSize={30}
              collapsible={false}
            >
              <div className="h-full overflow-y-auto">
                <CommentsThread fileId={selectedFile.id} openFile={openFile} />
              </div>
            </Panel>
          </>
        )}
      </PanelGroup>
    </Panel>
  );
}
