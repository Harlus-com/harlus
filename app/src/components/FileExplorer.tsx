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
  FolderPlus,
  Folder,
  Pencil,
} from "lucide-react";
import { WorkspaceFile, WorkspaceFolder } from "@/api/workspace_types";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const FileExplorer: React.FC<{ workspaceId: string }> = ({ workspaceId }) => {
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
  const [editingFolder, setEditingFolder] = React.useState<string | null>(null);
  const [newFolderName, setNewFolderName] = React.useState("");
  const [draggedItem, setDraggedItem] = React.useState<{
    type: "file" | "folder";
    id: string;
    path: string[];
  } | null>(null);
  const [isNewFolderOpen, setIsNewFolderOpen] = React.useState(false);

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

  const handleCreateFolder = async (parentPath: string[] = []) => {
    if (!newFolderName.trim()) return;
    await fileService.createFolder(workspaceId, [...parentPath, newFolderName]);
    setNewFolderName("");
    setIsNewFolderOpen(false);
    notifyFileListChanged();
  };

  const handleDeleteFolder = async (path: string[], e: React.MouseEvent) => {
    e.stopPropagation();
    await fileService.deleteFolder(workspaceId, path);
    notifyFileListChanged();
  };

  const handleRenameFolder = async (path: string[], newName: string) => {
    if (!newName.trim()) return;
    await fileService.renameFolder(workspaceId, path, newName);
    setEditingFolder(null);
    notifyFileListChanged();
  };

  const handleMoveItem = async (targetPath: string[]) => {
    if (!draggedItem) return;

    if (draggedItem.type === "file") {
      await fileService.moveFile(workspaceId, draggedItem.id, targetPath);
    } else {
      await fileService.moveFolder(workspaceId, draggedItem.path, targetPath);
    }

    setDraggedItem(null);
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
    const isEditing = editingFolder === pathKey;

    const handleDragStart = (
      e: React.DragEvent,
      type: "file" | "folder",
      id: string,
      path: string[]
    ) => {
      e.stopPropagation();
      setDraggedItem({ type, id, path });
    };

    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (draggedItem) {
        handleMoveItem(folder.path);
      }
    };

    return (
      <div
        key={pathKey}
        className="select-none"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {!isRoot && (
          <div
            className={cn(
              "flex items-center p-2 rounded-md cursor-pointer group",
              "hover:bg-muted"
            )}
            style={getIndentStyle(level)}
            onClick={() => toggleFolder(pathKey)}
            draggable
            onDragStart={(e) =>
              handleDragStart(e, "folder", pathKey, folder.path)
            }
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
            {isEditing ? (
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleRenameFolder(folder.path, newFolderName);
                  } else if (e.key === "Escape") {
                    setEditingFolder(null);
                    setNewFolderName("");
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
            ) : (
              <>
                <Folder
                  size={14}
                  className="mr-2 flex-shrink-0 text-yellow-500"
                />
                <span className="text-sm">{folder.name}</span>
                <div className="ml-auto opacity-0 group-hover:opacity-100 flex items-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingFolder(pathKey);
                      setNewFolderName(folder.name);
                    }}
                  >
                    <Pencil size={12} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={(e) => handleDeleteFolder(folder.path, e)}
                  >
                    <Trash2 size={12} />
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
        {isExpanded && (
          <>
            <div className="pl-2">
              <Popover open={isNewFolderOpen} onOpenChange={setIsNewFolderOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-xs"
                  >
                    <FolderPlus size={12} className="mr-2" />
                    New Folder
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2" align="start">
                  <div className="space-y-2">
                    <Input
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleCreateFolder(folder.path);
                        }
                      }}
                      placeholder="Enter folder name"
                      autoFocus
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setNewFolderName("");
                          setIsNewFolderOpen(false);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleCreateFolder(folder.path)}
                      >
                        Create
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
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
                draggable
                onDragStart={(e) =>
                  handleDragStart(e, "file", file.id, folder.path)
                }
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
