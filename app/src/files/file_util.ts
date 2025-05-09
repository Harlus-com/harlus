import { FileGroupCount } from "@/components/panels";
import {
  FilesToOpen,
  FlipToOpenFileGroup,
  isFileGroupCount,
} from "./file_types";
import { OpenFileGroup } from "@/components/OpenFileGroup";

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
  return [
    FileGroupCount.ONE,
    FileGroupCount.TWO,
    FileGroupCount.THREE,
    FileGroupCount.FOUR,
  ];
}
