import React, { useRef } from "react";
import { PanelGroup, Panel } from "react-resizable-panels";
import { FileGroupCount } from "./panels";
import PanelDivider from "./PanelDivider";
import { WorkspaceFile } from "@/api/types";
import PdfViewer, { PdfViewerRef } from "@/components/ReactPdfViewer";

export class OpenFileGroup {
  constructor(
    readonly files: { [key: string]: WorkspaceFile },
    readonly fileOrder: Set<string>,
    readonly selectedFile: WorkspaceFile | null
  ) {}

  addFile(file: WorkspaceFile, options: { select: boolean }) {
    const newFiles = this.shallowCopyFiles();
    newFiles[file.id] = file;
    const newFileOrder = this.shallowCopyFileOrder();
    newFileOrder.add(file.id);
    const newSelectedFile = options.select ? file : this.selectedFile;
    return new OpenFileGroup(newFiles, newFileOrder, newSelectedFile);
  }

  removeFile(fileId: string) {
    const newFiles = this.shallowCopyFiles();
    delete newFiles[fileId];
    const newFileOrder = this.shallowCopyFileOrder();
    newFileOrder.delete(fileId);
    const currentSelectedFile =
      this.selectedFile?.id === fileId ? null : this.selectedFile;
    const newSelectedFileId =
      currentSelectedFile?.id || OpenFileGroup.firstOrNull(newFileOrder);
    const newSelectedFile =
      newSelectedFileId === null ? null : newFiles[newSelectedFileId] || null;
    return new OpenFileGroup(newFiles, newFileOrder, newSelectedFile);
  }

  setSelectedFile(file: WorkspaceFile) {
    if (this.files[file.id] === undefined) {
      throw new Error(
        "Cannot set selected file to non-existent file (not found in file map)"
      );
    }
    if (!this.fileOrder.has(file.id)) {
      throw new Error(
        "Cannot set selected file to non-existent file (not found in order)"
      );
    }
    return new OpenFileGroup(
      this.shallowCopyFiles(),
      this.shallowCopyFileOrder(),
      file
    );
  }

  private shallowCopyFiles() {
    return Object.fromEntries(
      Array.from(this.fileOrder).map((id) => [id, this.files[id]])
    );
  }

  private shallowCopyFileOrder() {
    return new Set<string>(this.fileOrder);
  }

  private static firstOrNull(fileOrder: Set<string>) {
    return Array.from(fileOrder).length > 0 ? Array.from(fileOrder)[0] : null;
  }

  static empty() {
    return new OpenFileGroup({}, new Set(), null);
  }
}

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

  const makePanel = (idx: FileGroupCount) =>
    openFiles[idx] ? (
      <FileGroupPanel
        key={idx}
        openFileGroup={openFiles[idx]!}
        groupIndex={idx}
        onSelectFile={handleSelectFile}
        onCloseFile={handleCloseFile}
      />
    ) : null;

  return (
    <PanelGroup id="file-groups" direction="horizontal">
      {makePanel(FileGroupCount.ONE)}

      {fileGroupCount > FileGroupCount.ONE && (
        <>
          <PanelDivider />
          {makePanel(FileGroupCount.TWO)}
        </>
      )}

      {fileGroupCount > FileGroupCount.TWO && (
        <>
          <PanelDivider />
          {makePanel(FileGroupCount.THREE)}
        </>
      )}

      {fileGroupCount > FileGroupCount.THREE && (
        <>
          <PanelDivider />
          {makePanel(FileGroupCount.FOUR)}
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
      {selectedFile ? (
        <div>
          {/* ——— Tab Bar ——— */}
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

          {/* ——— File Viewer Pane ——— */}
          <PanelGroup
            id={`file-group-${groupIndex}-files`}
            direction="horizontal"
          >
            <div className="flex-1 bg-white h-full">
              <PdfViewer
                file={selectedFile}
                key={selectedFile.id}
                ref={viewerRef}
              />
            </div>
          </PanelGroup>
        </div>
      ) : (
        <div className="flex-1 bg-white h-full flex items-center justify-center">
          Empty File Group
        </div>
      )}
    </Panel>
  );
}
