import React from "react";
import {
  PanelGroup,
  Panel,
  ImperativePanelGroupHandle,
} from "react-resizable-panels";
import { FileGroupCount } from "./panels";
import PanelDivider from "./PanelDivider";
import PdfViewer from "@/components/ReactPdfViewer";
import { OpenFileGroup } from "./OpenFileGroup";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import CommentsThread from "../comments/CommentsThread";
import { useFileViewContext } from "@/files/FileViewContext";

export default function FileView() {
  const { getOpenFiles, getFileGroupOneRef } = useFileViewContext();
  const openFiles = getOpenFiles();
  const fileGroupCount = Object.values(openFiles).filter((g) => g).length;

  const makeFileGroup = (
    groupIndex: FileGroupCount,
    options: {
      panelDivider: boolean;
      onlyFileOpen: boolean;
      panelRef?: React.RefObject<ImperativePanelGroupHandle>;
    } = {
      panelDivider: true,
      onlyFileOpen: false,
    }
  ) => {
    if (!openFiles[groupIndex]) return null;

    return (
      <>
        {options.panelDivider && <PanelDivider />}
        <FileGroupPanel
          key={groupIndex}
          openFileGroup={openFiles[groupIndex]!}
          groupIndex={groupIndex}
          onlyFileOpen={options.onlyFileOpen}
          panelRef={options.panelRef}
        />
      </>
    );
  };

  return (
    <PanelGroup id="file-groups" direction="horizontal">
      {makeFileGroup(FileGroupCount.ONE, {
        panelDivider: false,
        onlyFileOpen: fileGroupCount === 1,
        panelRef: getFileGroupOneRef(),
      })}

      {fileGroupCount > FileGroupCount.ONE &&
        makeFileGroup(FileGroupCount.TWO, {
          panelDivider: true,
          onlyFileOpen: false,
        })}
    </PanelGroup>
  );
}

interface FileGroupPanelProps {
  openFileGroup: OpenFileGroup;
  groupIndex: FileGroupCount;
  onlyFileOpen: boolean;
  panelRef?: React.RefObject<ImperativePanelGroupHandle>;
}

function FileGroupPanel({
  openFileGroup,
  groupIndex,
  onlyFileOpen,
  panelRef,
}: FileGroupPanelProps) {
  const { files, selectedFile, showComments } = openFileGroup;
  const { handleFileSelect, closeFile, toggleComments, handleOpenFiles } =
    useFileViewContext();

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
                      onClick={() =>
                        handleFileSelect(file, {
                          showComments: showComments[file.id],
                          fileGroup: groupIndex,
                        })
                      }
                      className={`px-3 py-1 text-sm font-medium focus:outline-none ${
                        isActive
                          ? "text-blue-600"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      {file.name}
                    </button>
                    <button
                      onClick={() => closeFile(groupIndex, file.id)}
                      className="ml-1 text-gray-400 hover:text-gray-600 text-xs focus:outline-none"
                      aria-label={`Close ${file.name}`}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
            {selectedFile != null && !showComments[selectedFile.id] && (
              <Button
                onClick={() => toggleComments(groupIndex, selectedFile.id)}
                variant="ghost"
                size="sm"
                className="group relative z-10"
              >
                <MessageSquare size={16} />
                <div className="absolute top-full right-0 mt-1 px-2 py-1 text-xs bg-popover text-popover-foreground rounded-md shadow-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                  Toggle Comments
                </div>
              </Button>
            )}
          </div>
        </div>
      )}
      {/* TODO: Autosave per file */}
      <PanelGroup
        ref={panelRef}
        id={`file-group-${groupIndex}-viewer`}
        direction="horizontal"
      >
        <Panel
          id={`file-group-${groupIndex}-file`}
          order={1}
          defaultSize={onlyFileOpen ? 80 : 65}
          className="flex flex-col h-full min-h-0 overflow-auto"
        >
          {selectedFile != null ? (
            <div className="flex-1 min-h-0">
              <PdfViewer file={selectedFile} key={selectedFile.id} />
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
              defaultSize={onlyFileOpen ? 20 : 35}
            >
              <CommentsThread
                fileId={selectedFile.id}
                currentFileGroup={groupIndex}
                openFiles={handleOpenFiles}
                onClose={() => toggleComments(groupIndex, selectedFile.id)}
              />
            </Panel>
          </>
        )}
      </PanelGroup>
    </Panel>
  );
}
