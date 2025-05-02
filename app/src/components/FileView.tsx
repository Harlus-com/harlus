import React, { useRef } from "react";
import { PanelGroup, Panel } from "react-resizable-panels";
import { FileGroupCount } from "./panels";
import PanelDivider from "./PanelDivider";
import { WorkspaceFile } from "@/api/types";
import PdfViewer, { PdfViewerRef } from "@/components/ReactPdfViewer";
import { OpenFileGroup } from "./OpenFileGroup";

export interface FileViewProps {
  openFiles: Record<FileGroupCount, OpenFileGroup | null>;
  setOpenFiles: React.Dispatch<
    React.SetStateAction<Record<FileGroupCount, OpenFileGroup | null>>
  >;
}

export default function FileView({ openFiles, setOpenFiles }: FileViewProps) {
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

  return (
    <PanelGroup id="file-groups" direction="horizontal">
      {openFiles[FileGroupCount.ONE] && (
        <FileGroupPanel
          key={FileGroupCount.ONE}
          openFileGroup={openFiles[FileGroupCount.ONE]!}
          groupIndex={FileGroupCount.ONE}
          onSelectFile={handleSelectFile}
          onCloseFile={handleCloseFile}
        />
      )}

      {fileGroupCount > FileGroupCount.ONE && (
        <>
          <PanelDivider />
          {openFiles[FileGroupCount.TWO] && (
            <FileGroupPanel
              key={FileGroupCount.TWO}
              openFileGroup={openFiles[FileGroupCount.TWO]!}
              groupIndex={FileGroupCount.TWO}
              onSelectFile={handleSelectFile}
              onCloseFile={handleCloseFile}
            />
          )}
        </>
      )}

      {fileGroupCount > FileGroupCount.TWO && (
        <>
          <PanelDivider />
          {openFiles[FileGroupCount.THREE] && (
            <FileGroupPanel
              key={FileGroupCount.THREE}
              openFileGroup={openFiles[FileGroupCount.THREE]!}
              groupIndex={FileGroupCount.THREE}
              onSelectFile={handleSelectFile}
              onCloseFile={handleCloseFile}
            />
          )}
        </>
      )}

      {fileGroupCount > FileGroupCount.THREE && (
        <>
          <PanelDivider />
          {openFiles[FileGroupCount.FOUR] && (
            <FileGroupPanel
              key={FileGroupCount.FOUR}
              openFileGroup={openFiles[FileGroupCount.FOUR]!}
              groupIndex={FileGroupCount.FOUR}
              onSelectFile={handleSelectFile}
              onCloseFile={handleCloseFile}
            />
          )}
        </>
      )}
    </PanelGroup>
  );
}

interface FileGroupPanelProps {
  openFileGroup: OpenFileGroup;
  groupIndex: FileGroupCount;
  onSelectFile: (group: FileGroupCount, file: WorkspaceFile) => void;
  onCloseFile: (group: FileGroupCount, fileId: string) => void;
}

function FileGroupPanel({
  openFileGroup,
  groupIndex,
  onSelectFile,
  onCloseFile,
}: FileGroupPanelProps) {
  const viewerRef = useRef<PdfViewerRef>(null);
  const { files, selectedFile } = openFileGroup;

  return (
    <Panel id={`file-group-${groupIndex}`} order={1}>
      {selectedFile != null && (
        <div className="bg-white p-4 border-b border-border">
          <div className="flex space-x-1 border-b border-gray-200">
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
        </div>
      )}
      <PanelGroup id={`file-group-${groupIndex}-files`} direction="horizontal">
        {selectedFile != null ? (
          <div className="flex-1 bg-white">
            <div className="h-full">
              <PdfViewer
                file={selectedFile}
                key={selectedFile.id}
                ref={viewerRef}
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 bg-white h-full flex items-center justify-center">
            Empty File Group
          </div>
        )}
      </PanelGroup>
    </Panel>
  );
}
