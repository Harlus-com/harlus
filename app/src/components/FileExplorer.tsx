import React from "react";
import {
  File,
  Trash2,
  MoreVertical,
  Columns2,
  RefreshCw,
  RotateCcw,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { WorkspaceFile } from "@/api/workspace_types";
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
import { fileGroupCounts } from "@/files/file_util";
import { useFileContext } from "@/files/FileContext";
import { useFileViewContext } from "@/files/FileViewContext";
import { FolderNode, buildFolderTree } from "@/files/file_hierarchy";

const FileExplorer: React.FC = () => {
  const {
    getFiles,
    getFolders,
    notifyFileListChanged,
    forceSyncFile,
    startSyncFile,
  } = useFileContext();
  const { getOpenFiles, openFiles } = useFileViewContext();
  const files = getFiles();
  const folders = getFolders();
  const [expandedFolders, setExpandedFolders] = React.useState<Set<string>>(
    new Set()
  );

  const selectedFileIds: string[] = [];
  for (const fileGroup of Object.values(getOpenFiles())) {
    if (fileGroup && !!fileGroup.selectedFile) {
      selectedFileIds.push(fileGroup.selectedFile!.id);
    }
  }

  const handleDeleteFile = async (file: WorkspaceFile, e: React.MouseEvent) => {
    e.stopPropagation();
    await fileService.deleteFile(file);
    notifyFileListChanged();
  };

  const handleOpenInGroup = (
    file: WorkspaceFile,
    groupNumber: FileGroupCount
  ) => {
    openFiles({
      [file.id]: { fileGroup: groupNumber, showComments: false, select: true },
    });
  };

  const handleForceSync = async (file: WorkspaceFile, e: React.MouseEvent) => {
    e.stopPropagation();
    forceSyncFile(file.id);
  };

  const handlePing = async (file: WorkspaceFile, e: React.MouseEvent) => {
    e.stopPropagation();
    startSyncFile(file.id);
  };

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const getIndentStyle = (level: number) => {
    return { marginLeft: `${level * 0.5}rem` };
  };

  const renderFolder = (folder: FolderNode, level: number = 0) => {
    const pathKey = folder.path.join("/");
    const hasChildren = folder.children.size > 0 || folder.files.length > 0;
    const isRoot = folder.path.length === 0;
    const isExpanded = isRoot || expandedFolders.has(pathKey);

    return (
      <div key={pathKey} className="select-none">
        {!isRoot && (
          <div
            className={cn(
              "flex items-center p-2 rounded-md cursor-pointer",
              "hover:bg-muted"
            )}
            style={getIndentStyle(level)}
            onClick={() => toggleFolder(pathKey)}
          >
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown size={14} className="mr-2 flex-shrink-0" />
              ) : (
                <ChevronRight size={14} className="mr-2 flex-shrink-0" />
              )
            ) : (
              <div className="w-6" />
            )}
            <span className="text-sm">{folder.name}</span>
          </div>
        )}
        {isExpanded && (
          <>
            {Array.from(folder.children.values()).map((child) =>
              renderFolder(child, level + 1)
            )}
            {folder.files.map((file) => (
              <div
                key={file.id}
                className={cn(
                  "flex items-center p-2 rounded-md",
                  "hover:bg-muted",
                  selectedFileIds.includes(file.id) && "bg-muted font-medium"
                )}
                style={getIndentStyle(level + 1)}
              >
                <div
                  className="flex items-center flex-1 min-w-0 cursor-pointer"
                  onClick={() => handleOpenInGroup(file, FileGroupCount.ONE)}
                >
                  <File
                    size={14}
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
                    <DropdownMenuItem onClick={(e) => handlePing(file, e)}>
                      <RotateCcw size={14} className="mr-2" />
                      Sync
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => handleForceSync(file, e)}>
                      <RefreshCw size={14} className="mr-2" />
                      Force Reload
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
            ))}
          </>
        )}
      </div>
    );
  };

  const folderTree = buildFolderTree(files, folders);

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
              renderFolder(folderTree)
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
