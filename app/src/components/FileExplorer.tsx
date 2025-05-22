import React from "react";
import {
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
  Upload,
  X,
  Info,
} from "lucide-react";
import { WorkspaceFile, Workspace } from "@/api/workspace_types";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { fileService } from "@/api/fileService";
import FileStatusIndicator from "@/files/FileStatusIndicator";
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
import FileInfoDialog from "@/files/FileInfoDialog";
import RefreshDataDialog from "./RefreshDataDialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import SyncDialog from "./SyncDialog";

type RenameInfo = {
  renameFile?: LocalFile;
  renameFolder?: LocalFolder;
  parentFolder?: LocalFolder;
  newName?: string;
};

const FileExplorer: React.FC<{
  workspaceId: string;
  workspace: Workspace | null;
}> = ({ workspaceId, workspace }) => {
  const {
    getFiles,
    getFolders,
    notifyFileSyncStatusChanged,
    forceSyncFile,
    startSyncFile,
    workspaceFileToLocalFile,
    getLocalFolder,
  } = useFileContext();
  const { getOpenFiles, openFiles } = useFileViewContext();
  const files = getFiles();
  const folders = getFolders();
  const [closedFolders, setClosedFolders] = React.useState<Set<string>>(
    new Set()
  );
  const [draggedItem, setDraggedItem] = React.useState<
    LocalFile | LocalFolder | null
  >(null);
  const [renameInfo, setRenameInfo] = React.useState<RenameInfo | null>(null);
  const [folderToDelete, setFolderToDelete] = React.useState<{
    path: string[];
    name: string;
  } | null>(null);
  const [fileToDelete, setFileToDelete] = React.useState<WorkspaceFile | null>(
    null
  );
  const [fileInfoOpen, setFileInfoOpen] = React.useState<LocalFile | null>(
    null
  );
  const [draggingOverPath, setDraggingOverPath] = React.useState<string | null>(
    null
  );
  const [syncDialogOpen, setSyncDialogOpen] = React.useState(false);
  const [syncDialogFolderPath, setSyncDialogFolderPath] = React.useState<
    string[] | undefined
  >(undefined);

  const selectedFileIds: string[] = [];
  for (const fileGroup of Object.values(getOpenFiles())) {
    if (fileGroup && !!fileGroup.selectedFile) {
      selectedFileIds.push(fileGroup.selectedFile!.id);
    }
  }

  const handleDeleteFile = async (file: WorkspaceFile, e: React.MouseEvent) => {
    e.stopPropagation();
    setFileToDelete(file);
  };

  const handleRename = async () => {
    if (!renameInfo) {
      return;
    }
    const { renameFile, renameFolder, parentFolder, newName } = renameInfo;
    if (!newName?.trim()) {
      return;
    }
    if (renameFile) {
      await fileService.renameFile(renameFile, newName, workspace);
    } else if (renameFolder) {
      await fileService.renameFolder(renameFolder, newName, workspace);
    } else if (parentFolder) {
      await fileService.createFolder(parentFolder, newName);
    }
    setRenameInfo(null);
  };

  const handleDeleteFolder = async (path: string[], e: React.MouseEvent) => {
    e.stopPropagation();
    setFolderToDelete({
      path,
      name: path[path.length - 1],
    });
  };

  const handleMoveItem = async (targetPath: string[]) => {
    if (!draggedItem) return;
    if ((draggedItem as LocalFile).contentHash) {
      await fileService.moveItem(
        draggedItem as LocalFile,
        targetPath,
        workspace
      );
    } else {
      await fileService.moveFolder(
        draggedItem as LocalFolder,
        targetPath,
        workspace
      );
      setDraggedItem(null);
    }
  };

  const handleOpenInGroup = (
    file: WorkspaceFile,
    groupNumber: FileGroupCount
  ) => {
    openFiles({
      [file.id]: {
        fileGroup: groupNumber,
        showComments: false,
        select: true,
      },
    });
  };

  const handleForceSync = async (file: WorkspaceFile, e: React.MouseEvent) => {
    e.stopPropagation();
    forceSyncFile(workspaceFileToLocalFile(file));
  };

  const handlePing = async (file: WorkspaceFile, e: React.MouseEvent) => {
    e.stopPropagation();
    startSyncFile(workspaceFileToLocalFile(file));
  };

  const toggleFolder = (path: string) => {
    setClosedFolders((prev) => {
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

  const confirmDeleteFolder = async () => {
    if (!folderToDelete) return;
    await fileService.deleteFolder(getLocalFolder(folderToDelete.path)!);
    setFolderToDelete(null);
  };

  const confirmDeleteFile = async () => {
    if (!fileToDelete) return;
    await fileService.deleteLocalFile(workspaceFileToLocalFile(fileToDelete));
    setFileToDelete(null);
  };

  const handleDragOver = (e: React.DragEvent, path: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingOverPath(path);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingOverPath(null);
  };

  const handleDropInRoot = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingOverPath(null);
    if (draggedItem) {
      handleMoveItem([]); // Empty array represents root folder
    }
  };

  const renderFolder = (folder: FolderNode, level: number = 0) => {
    const pathKey = folder.path.join("/");
    const hasChildren = folder.children.size > 0 || folder.files.length > 0;
    const isRoot = folder.path.length === 0;
    const isExpanded = !closedFolders.has(pathKey);
    const isRenamePopoverOpen = !!renameInfo;

    const handleDragStart = (
      e: React.DragEvent,
      item: LocalFile | LocalFolder
    ) => {
      e.stopPropagation();
      setDraggedItem(item);
    };

    return (
      <div
        key={pathKey}
        className="select-none"
        onDragOver={(e) => handleDragOver(e, pathKey)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDraggingOverPath(null);
          if (draggedItem) {
            handleMoveItem(folder.path);
          }
        }}
      >
        {!isRoot && (
          <div
            className={cn(
              "flex items-center p-2 rounded-md cursor-pointer group",
              "hover:bg-muted",
              draggingOverPath === pathKey &&
                "border-2 border-dashed border-primary"
            )}
            style={getIndentStyle(level)}
            onClick={() => toggleFolder(pathKey)}
            draggable
            onDragStart={(e) =>
              handleDragStart(e, getLocalFolder(folder.path)!)
            }
          >
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown size={14} className="mr-2 flex-shrink-0" />
              ) : (
                <ChevronRight size={14} className="mr-2 flex-shrink-0" />
              )
            ) : (
              <div className="w-[22px] flex-shrink-0" />
            )}
            <Folder size={14} className="mr-2 flex-shrink-0 text-yellow-500" />
            <span className="text-sm">{folder.name}</span>
            <div className="ml-auto opacity-0 group-hover:opacity-100">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical size={12} className="text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      setRenameInfo({
                        newName: folder.name,
                        renameFolder: getLocalFolder(folder.path)!,
                      });
                    }}
                  >
                    <Pencil size={12} className="mr-2" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      setRenameInfo({
                        parentFolder: getLocalFolder(folder.path)!,
                      });
                    }}
                  >
                    <FolderPlus size={12} className="mr-2" />
                    New Subfolder
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      setSyncDialogFolderPath(folder.path);
                      setSyncDialogOpen(true);
                    }}
                  >
                    <RefreshCw size={12} className="mr-2" />
                    Sync
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-red-500 focus:text-red-500"
                    onClick={(e) => handleDeleteFolder(folder.path, e)}
                  >
                    <Trash2 size={12} className="mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )}

        <Popover
          open={isRenamePopoverOpen}
          onOpenChange={(open) => {
            if (!open) {
              setRenameInfo(null);
            }
          }}
          modal={true}
        >
          <PopoverTrigger asChild>
            <div className="hidden">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  setRenameInfo({
                    parentFolder: getLocalFolder(folder.path)!,
                  });
                }}
              >
                <FolderPlus size={12} className="mr-2" />
                New Folder
              </Button>
            </div>
          </PopoverTrigger>
          <PopoverContent
            className="w-64 p-2"
            align="start"
            onClick={(e) => e.stopPropagation()}
            onPointerDownOutside={(e) => e.preventDefault()}
          >
            <div className="space-y-2">
              <Input
                value={renameInfo?.newName}
                onChange={(e) =>
                  setRenameInfo({
                    ...renameInfo,
                    newName: e.target.value,
                  })
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleRename();
                  }
                }}
                placeholder={getRenamePlaceholder(renameInfo)}
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setRenameInfo(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRename();
                  }}
                >
                  {renameInfo?.parentFolder ? "Create" : "Rename"}
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {isExpanded && (
          <>
            {Array.from(folder.children.values()).map((child) =>
              renderFolder(child, level + 1)
            )}
            {folder.files.map((file) => (
              <div
                key={file.id}
                className={cn(
                  "flex items-center p-2 rounded-md group",
                  "hover:bg-muted",
                  selectedFileIds.includes(file.id) && "bg-muted font-medium"
                )}
                style={getIndentStyle(level + 1)}
                draggable
                onDragStart={(e) =>
                  handleDragStart(e, workspaceFileToLocalFile(file))
                }
              >
                <div className="w-[22px] flex-shrink-0" />
                <div
                  className="flex items-center flex-1 min-w-0 cursor-pointer"
                  onClick={() => handleOpenInGroup(file, FileGroupCount.ONE)}
                >
                  <FileStatusIndicator file={file} className="mr-2" />
                  <span className="truncate text-sm flex-1">{file.name}</span>
                </div>
                <div className="opacity-0 group-hover:opacity-100">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical
                          size={12}
                          className="text-muted-foreground"
                        />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger>
                          <Columns2 size={12} className="mr-2" />
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
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenameInfo({
                            renameFile: workspaceFileToLocalFile(file),
                            newName: file.name,
                          });
                        }}
                      >
                        <Pencil size={12} className="mr-2" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => handlePing(file, e)}>
                        <RotateCcw size={12} className="mr-2" />
                        Sync
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => handleForceSync(file, e)}
                      >
                        <RefreshCw size={12} className="mr-2" />
                        Force Reload
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          const localFile = workspaceFileToLocalFile(file);
                          if (localFile) {
                            fileService
                              .uploadFile(workspaceId, localFile)
                              .then(() => {
                                notifyFileSyncStatusChanged();
                              });
                          }
                        }}
                      >
                        <Upload size={12} className="mr-2" />
                        Track
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          fileService.deleteFile(file).then(() => {
                            notifyFileSyncStatusChanged();
                          });
                        }}
                      >
                        <X size={12} className="mr-2" />
                        Untrack
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setFileInfoOpen(workspaceFileToLocalFile(file)!);
                        }}
                      >
                        <Info size={12} className="mr-2" />
                        Info
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-red-500 focus:text-red-500"
                        onClick={(e) => handleDeleteFile(file, e)}
                      >
                        <Trash2 size={12} className="mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="h-full bg-sidebar border-r border-border flex flex-col">
        <div className="flex items-center gap-2 p-2 border-b border-border">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() =>
                    setRenameInfo({
                      parentFolder: {
                        absolutePath: workspace!.localDir,
                        pathRelativeToWorkspace: [],
                      },
                    })
                  }
                >
                  <FolderPlus size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>New Folder</TooltipContent>
            </Tooltip>

            <RefreshDataDialog workspace={workspace} />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setSyncDialogOpen(true)}
                >
                  <RefreshCw size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Sync</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-gray-300">
          <div className="h-full p-2">
            <div
              className={cn(
                "h-full space-y-1 rounded-md transition-colors",
                draggingOverPath === "" &&
                  "h-full border-2 border-dashed border-primary"
              )}
              onDragOver={(e) => handleDragOver(e, "")}
              onDragLeave={handleDragLeave}
              onDrop={handleDropInRoot}
            >
              {files.length === 0 ? (
                <div className="text-muted-foreground text-sm italic p-2">
                  No files yet.
                </div>
              ) : (
                renderFolder(buildFolderTree(files, folders))
              )}
            </div>
          </div>
        </div>

        <div className="p-3 border-t border-border">
          <div className="text-xs text-muted-foreground">
            {getFileFolderText(files.length, folders.length)}
          </div>
        </div>
      </div>

      <AlertDialog
        open={!!folderToDelete}
        onOpenChange={(open) => !open && setFolderToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Folder</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {folderToDelete?.path.join("/")}?
              This will delete all subfolders and files within it on your local
              file system. You will not be able to undo this action.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteFolder}
              className="bg-red-500 hover:bg-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={!!fileToDelete}
        onOpenChange={(open) => !open && setFileToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete File</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {fileToDelete?.name}? This will
              delete the file on your local filesystem. You will not be able to
              undo this action.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteFile}
              className="bg-red-500 hover:bg-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {fileInfoOpen && (
        <FileInfoDialog
          file={fileInfoOpen}
          open={true}
          onOpenChange={(open) => !open && setFileInfoOpen(null)}
        />
      )}
      <SyncDialog
        open={syncDialogOpen}
        onOpenChange={(open) => {
          setSyncDialogOpen(open);
          if (!open) {
            setSyncDialogFolderPath(undefined);
          }
        }}
        workspace={workspace}
        folderPath={syncDialogFolderPath}
      />
    </>
  );
};

function getFileFolderText(fileCount: number, folderCount: number) {
  let fileText = "";
  if (fileCount > 0) {
    fileText = `${fileCount} ${fileCount === 1 ? "file" : "files"}`;
  }
  let folderText = "";
  if (folderCount > 0) {
    folderText = `${folderCount} ${folderCount === 1 ? "folder" : "folders"}`;
  }
  if (fileText && folderText) {
    return `${fileText}, ${folderText}`;
  }
  if (fileText) {
    return fileText;
  }
  if (folderText) {
    return folderText;
  }
  return "No files or folders";
}

function getRenamePlaceholder(renameInfo: RenameInfo | null) {
  if (!renameInfo) {
    return "";
  }
  if (renameInfo.renameFile) {
    return renameInfo.renameFile.name;
  }
  if (renameInfo.renameFolder) {
    const path = renameInfo.renameFolder.pathRelativeToWorkspace;
    return path[path.length - 1];
  }
  if (renameInfo.parentFolder) {
    return "New folder name";
  }
}

export default FileExplorer;
