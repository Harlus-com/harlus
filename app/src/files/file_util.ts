import { FileGroupCount } from "@/components/panels";
import {
  FilesToOpen,
  FlipToOpenFileGroup,
  isFileGroupCount,
} from "./file_types";
import { OpenFileGroup } from "@/components/OpenFileGroup";
import { WorkspaceFile } from "@/api/workspace_types";

export function getFileGroupsToOpen(
  filesToOpen: FilesToOpen
): FileGroupCount[] {
  return Array.from(
    new Set(
      Object.entries(filesToOpen)
        .map(([fileId, options]) => options.fileGroup)
        .filter(isFileGroupCount)
    )
  );
}

export function getTargetFileGroup(
  fileId: string,
  fileGroup: FileGroupCount | FlipToOpenFileGroup,
  openFiles: Record<FileGroupCount, OpenFileGroup | null>
): FileGroupCount {
  return isFileGroupCount(fileGroup)
    ? fileGroup
    : flipTarget(fileId, fileGroup, openFiles);
}

function flipTarget(
  fileId: string,
  fileGroup: FlipToOpenFileGroup,
  openFiles: Record<FileGroupCount, OpenFileGroup | null>
): FileGroupCount {
  const fileIsAlreadyOpenGroups = groupsFileIsIn(fileId, openFiles);
  const candidateFileIsAlreadyOpenGroups = fileIsAlreadyOpenGroups.filter(
    (group) => group != fileGroup.currentFileGroup
  );
  if (candidateFileIsAlreadyOpenGroups.length > 0) {
    return nearestOpenFileGroup(
      fileGroup.currentFileGroup,
      candidateFileIsAlreadyOpenGroups
    );
  }
  const openFileGroups = getOpenFileGroups(openFiles);
  const candidateOpenFileGroups = openFileGroups.filter(
    (group) => group != fileGroup.currentFileGroup
  );
  if (candidateOpenFileGroups.length > 0) {
    return nearestOpenFileGroup(
      fileGroup.currentFileGroup,
      candidateOpenFileGroups
    );
  }
  // If there are no other open file groups, then the only file group open, must be ONE!
  return FileGroupCount.TWO;
}

function nearestOpenFileGroup(
  current: FileGroupCount,
  targets: FileGroupCount[]
): FileGroupCount {
  const distanceFromCurrent: { group: FileGroupCount; distance: number }[] =
    targets.map((group) => ({
      group,
      distance: Math.abs(group - current),
    }));
  return distanceFromCurrent.sort((a, b) => a.distance - b.distance)[0].group;
}
function getOpenFileGroups(
  openFiles: Record<FileGroupCount, OpenFileGroup | null>
): FileGroupCount[] {
  return fileGroupCounts().filter((group) => openFiles[group] != null);
}

function groupsFileIsIn(
  fileId: string,
  openFiles: Record<FileGroupCount, OpenFileGroup | null>
): FileGroupCount[] {
  const currentFileGroups: FileGroupCount[] = [];
  for (const fileGroup of fileGroupCounts()) {
    const files = openFiles[fileGroup]?.files || {};
    if (files[fileId]) {
      currentFileGroups.push(fileGroup);
    }
  }
  return currentFileGroups;
}

export function fileGroupCounts() {
  return [FileGroupCount.ONE, FileGroupCount.TWO];
}

export function toWorkspaceFile(
  workspaceId: string,
  localFile: LocalFile
): WorkspaceFile {
  return {
    id: localFile.contentHash,
    name: localFile.name,
    workspaceId,
    appDir: localFile.pathRelativeToWorkspace,
  };
}

export function noLocalFolderChanges(
  aFolders: LocalFolder[],
  bFolders: LocalFolder[]
) {
  const aByHash = new Map<string, LocalFolder>();
  const bByHash = new Map<string, LocalFolder>();
  for (const folder of aFolders) {
    aByHash.set(folder.absolutePath, folder);
  }
  for (const folder of bFolders) {
    bByHash.set(folder.absolutePath, folder);
  }
  for (const a of aFolders) {
    const b = bByHash.get(a.absolutePath);
    if (!b) {
      return false;
    }
    if (!localFoldersAreEqual(a, b)) {
      return false;
    }
  }
  for (const b of bFolders) {
    const a = aByHash.get(b.absolutePath);
    if (!a) {
      return false;
    }
    if (!localFoldersAreEqual(a, b)) {
      return false;
    }
  }
  return true;
}

function localFoldersAreEqual(a: LocalFolder, b: LocalFolder) {
  return (
    a.absolutePath === b.absolutePath &&
    a.pathRelativeToWorkspace.join("/") === b.pathRelativeToWorkspace.join("/")
  );
}

export function noLocalFileChanges(aFiles: LocalFile[], bFiles: LocalFile[]) {
  const aByHash = new Map<string, LocalFile>();
  const bByHash = new Map<string, LocalFile>();
  for (const file of aFiles) {
    aByHash.set(file.contentHash, file);
  }
  for (const file of bFiles) {
    bByHash.set(file.contentHash, file);
  }
  for (const a of aFiles) {
    const b = bByHash.get(a.contentHash);
    if (!b) {
      return false;
    }
    if (!localFilesAreEqual(a, b)) {
      return false;
    }
  }
  for (const b of bFiles) {
    const a = aByHash.get(b.contentHash);
    if (!aByHash.has(b.contentHash)) {
      return false;
    }
    if (!localFilesAreEqual(a, b)) {
      return false;
    }
  }
  return true;
}

function localFilesAreEqual(a: LocalFile, b: LocalFile) {
  return (
    a.absolutePath === b.absolutePath &&
    a.contentHash === b.contentHash &&
    a.name === b.name &&
    a.pathRelativeToWorkspace.join("/") === b.pathRelativeToWorkspace.join("/")
  );
}
