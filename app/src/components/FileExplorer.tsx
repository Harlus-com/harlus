import React, { useState } from "react";
import { File, Trash2, MoreVertical } from "lucide-react";
import { WorkspaceFile } from "@/api/types";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { fileService } from "@/api/fileService";
import FileStatusIndicator from "./FileStatusIndicator";
import { FileGroupCount } from "./panels";
import { OpenFileGroup } from "./FileView";

interface FileExplorerProps {
  files: WorkspaceFile[];
  onFileSelect: (file: WorkspaceFile) => void;
  openFiles: Record<FileGroupCount, OpenFileGroup | null>;
  onFilesChange?: (files: WorkspaceFile[]) => void;
}

const FileExplorer: React.FC<FileExplorerProps> = ({
  files,
  onFileSelect,
  openFiles,
}) => {
  const selectedFileIds: string[] = [];
  for (const fileGroup of Object.values(openFiles)) {
    if (fileGroup && fileGroup.selectedFile !== null) {
      selectedFileIds.push(fileGroup.selectedFile!.id);
    }
  }
  const handleDeleteFile = async (file: WorkspaceFile, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent file selection when deleting

    await fileService.deleteFile(file);
    // TODO: Notify UI
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
                    onClick={() => onFileSelect(file)}
                  >
                    <File
                      size={16}
                      className="mr-2 flex-shrink-0 text-blue-500"
                    />
                    <span className="truncate text-sm flex-1">{file.name}</span>
                    <FileStatusIndicator file={file} className="ml-2" />
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
