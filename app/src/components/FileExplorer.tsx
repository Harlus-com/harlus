import React, { useState } from "react";
import { File, FileText, FileSpreadsheet, Trash2, MoreVertical, Columns2, RefreshCw, ChevronRight, ChevronDown, Folder as FolderIcon, Plus } from "lucide-react";
import { WorkspaceFile, Folder } from "@/api/workspace_types";
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
import FileStatusIndicator from "./FileStatusIndicator";
import { FileGroupCount } from "./panels";
import { OpenFileGroup } from "./OpenFileGroup";
import { Button } from "./ui/button";

interface FileExplorerProps {
  files: WorkspaceFile[];
  folders: Folder[];
  onFileSelect: (file: WorkspaceFile, groupNumber: FileGroupCount) => void;
  openFiles: Record<FileGroupCount, OpenFileGroup | null>;
  onFilesChange: (files: WorkspaceFile[]) => void;
  onFoldersChange: (folders: Folder[]) => void;
}

const FileExplorer: React.FC<FileExplorerProps> = ({
  files,
  folders,
  onFileSelect,
  openFiles,
  onFilesChange,
  onFoldersChange,
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

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
    onFileSelect(file, groupNumber);
  };

  const handleForceSync = async (file: WorkspaceFile, e: React.MouseEvent) => {
    e.stopPropagation();
    await fileService.forceSyncFile(file);
  };

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const getFilesInFolder = (folder: Folder) => {
    return files
      .filter(file => file.appDir.length > 0 && file.appDir[0] === folder.name)
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  const renderFile = (file: WorkspaceFile) => {
    // Get file extension
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    
    // Select icon based on file extension
    let FileIcon = File;
    let iconColor = "text-blue-500";
    
    switch (fileExt) {
      case 'pdf':
        FileIcon = FileText;
        iconColor = "text-red-500";
        break;
      case 'xls':
      case 'xlsx':
        FileIcon = FileSpreadsheet;
        iconColor = "text-green-500";
        break;
      case 'doc':
      case 'docx':
        FileIcon = FileText;
        iconColor = "text-blue-600";
        break;
      default:
        FileIcon = File;
        iconColor = "text-blue-500";
    }

    return (
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
          onClick={() => onFileSelect(file, FileGroupCount.ONE)}
        >
          <FileIcon
            size={12}
            className={`mr-2 flex-shrink-0 ${iconColor}`}
          />
          <span className="truncate text-sm flex-1">{file.name}</span>
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
                {[1, 2, 3, 4].map((groupNumber) => (
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
    );
  };

  const renderFolder = (folder: Folder) => {
    const filesInFolder = getFilesInFolder(folder);
    const folderId = folder.appDir.join('-') || folder.name;
    
    return (
      <div key={folderId}>
        <div
          className="flex items-center p-2 rounded-md hover:bg-muted cursor-pointer"
          onClick={() => toggleFolder(folderId)}
        >
          {expandedFolders.has(folderId) ? (
            <ChevronDown size={16} className="mr-2 text-muted-foreground" />
          ) : (
            <ChevronRight size={16} className="mr-2 text-muted-foreground" />
          )}
          <span className="text-sm">{folder.name}</span>
        </div>
        {expandedFolders.has(folderId) && (
          <div className="pl-6">
            {filesInFolder.map(renderFile)}
          </div>
        )}
      </div>
    );
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
              <>
                {folders && folders.length > 0 
                  ? [...folders].sort((a, b) => a.name.localeCompare(b.name)).map(renderFolder) 
                  : null}
                {files
                  .filter(file => file.appDir.length === 0)
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map(renderFile)}
              </>
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
