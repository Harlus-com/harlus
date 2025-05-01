import React, { useState } from "react";
import {
  File,
  Trash2,
  Volleyball,
  MoreVertical,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { WorkspaceFile } from "@/api/types";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { fileService } from "@/api/fileService";
import FileStatusIndicator from "./FileStatusIndicator";

interface FileExplorerProps {
  files: WorkspaceFile[];
  onFileSelect: (file: WorkspaceFile) => void;
  selectedFile: WorkspaceFile | null;
  onFilesChange?: (files: WorkspaceFile[]) => void;
}

const FileExplorer: React.FC<FileExplorerProps> = ({
  files,
  onFileSelect,
  selectedFile,
  onFilesChange,
}) => {
  const [knowledgeGraphStatus, setKnowledgeGraphStatus] = useState<{
    status: "up-to-date" | "syncing" | "error";
    message: string;
  }>({
    status: "up-to-date",
    message: "Knowledge Graph is up to date",
  });

  const handleDeleteFile = async (file: WorkspaceFile, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent file selection when deleting

    try {
      await fileService.deleteFile(file);

      // Update the files list
      const updatedFiles = files.filter((f) => f.id !== file.id);
      if (onFilesChange) {
        onFilesChange(updatedFiles);
      }

      // If the deleted file was selected, clear the selection
      if (selectedFile?.id === file.id) {
        onFileSelect(null);
      }
    } catch (error) {
      console.error("Error deleting file:", error);
    }
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
                    selectedFile?.id === file.id && "bg-muted font-medium"
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
