import React, { useRef, useState } from "react";
import { File, Trash2, MoreVertical, Columns2, RefreshCw } from "lucide-react";
import { SyncStatus, WorkspaceFile } from "@/api/workspace_types";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { fileService } from "@/api/fileService";
import FileStatusIndicator, {
  FileStatusIndicatorHandle,
} from "./FileStatusIndicator";
import { FileGroupCount } from "./panels";
import { OpenFileGroup } from "./OpenFileGroup";
import { fileGroupCounts } from "@/files/file_util";
import { FilesToOpen, OpenFilesOptions } from "@/files/file_types";
import { modelService } from "@/api/model_service";
interface FileExplorerProps {
  files: WorkspaceFile[];
  openFiles: Record<FileGroupCount, OpenFileGroup | null>;
  onFilesChange: (files: WorkspaceFile[]) => void;
  handleOpenFiles: (
    filesToOpen: FilesToOpen,
    options?: OpenFilesOptions
  ) => void;
}

const FileExplorer: React.FC<FileExplorerProps> = ({
  files,
  openFiles,
  onFilesChange,
  handleOpenFiles,
}) => {
  const statusRefs = useRef<
    Record<string, React.RefObject<FileStatusIndicatorHandle>>
  >({});
  files.forEach((file) => {
    if (!statusRefs.current[file.id]) {
      statusRefs.current[file.id] =
        React.createRef<FileStatusIndicatorHandle>();
    }
  });

  const selectedFileIds: string[] = [];
  for (const fileGroup of Object.values(openFiles)) {
    if (fileGroup && !!fileGroup.selectedFile) {
      selectedFileIds.push(fileGroup.selectedFile!.id);
    }
  }

  const handleDeleteFile = async (file: WorkspaceFile, e: React.MouseEvent) => {
    e.stopPropagation();
    await fileService.deleteFile(file);
    onFilesChange(files.filter((f) => f.id !== file.id));
  };

  const handleOpenInGroup = (
    file: WorkspaceFile,
    groupNumber: FileGroupCount
  ) => {
    handleOpenFiles({
      [file.id]: { fileGroup: groupNumber, showComments: false, select: true },
    });
  };

  const handleForceSync = async (file: WorkspaceFile, e: React.MouseEvent) => {
    e.stopPropagation();
    statusRefs.current[file.id]?.current?.setStatus("SYNC_PENDING");
    await modelService.forceSyncFile(file);
  };

  const handlePing = async (file: WorkspaceFile, e: React.MouseEvent) => {
    e.stopPropagation();
    statusRefs.current[file.id]?.current?.setStatus("SYNC_PENDING");
    await modelService.startSyncFile(file);
  };

  return (
    <div className="h-full bg-sidebar border-r border-border flex flex-col">
      <div className="flex-1 overflow-auto p-2 scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-gray-300">
        <div className="mb-2">
          <div className="pl-1 mt-1 space-y-1">
            {files.length === 0 ? (
              <div className="text-muted-foreground text-sm italic p-2">
                No files yet. Drag and drop PDFs here.
              </div>
            ) : (
              files.map((file) => (
                <div
                  key={file.id}
                  className={cn(
                    "flex items-center p-2 rounded-md",
                    "hover:bg-muted",
                    selectedFileIds.includes(file.id) && "bg-muted font-medium"
                  )}
                >
                  <div
                    className="flex items-center flex-1 min-w-0 cursor-pointer"
                    onClick={() => handleOpenInGroup(file, FileGroupCount.ONE)}
                  >
                    <File
                      size={16}
                      className="mr-2 flex-shrink-0 text-blue-500"
                    />
                    <span className="truncate text-sm flex-1">{file.name}</span>
                    <FileStatusIndicator
                      ref={statusRefs.current[file.id]}
                      file={file}
                      className="ml-2"
                    />
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-1 hover:bg-muted rounded-md flex-shrink-0 ml-2">
                        <MoreVertical
                          size={14}
                          className="text-muted-foreground"
                        />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                          <Columns2 size={14} className="mr-2" />
                          Open in file group
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                          {fileGroupCounts().map((groupNumber) => (
                            <DropdownMenuItem
                              key={groupNumber}
                              onClick={() =>
                                handleOpenInGroup(
                                  file,
                                  groupNumber as FileGroupCount
                                )
                              }
                            >
                              {groupNumber}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                      <DropdownMenuItem
                        onClick={(e) => handleForceSync(file, e)}
                      >
                        <RefreshCw size={14} className="mr-2" />
                        Force Sync
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => handlePing(file, e)}>
                        <RefreshCw size={14} className="mr-2" />
                        Ping
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-500 focus:text-red-500"
                        onClick={(e) => handleDeleteFile(file, e)}
                      >
                        <Trash2 size={14} className="mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="p-3 border-t border-border">
        <div className="text-xs text-muted-foreground">
          Drag PDF files here to analyze
        </div>
      </div>
    </div>
  );
};

export default FileExplorer;
