import { FileGroupCount } from "@/components/panels";

export type FlipToOpenFileGroup = {
  flipToOpenFileGroup: true;
  currentFileGroup: FileGroupCount;
};

export interface OpenFileOptions {
  showComments: boolean;
  fileGroup: FileGroupCount | FlipToOpenFileGroup;
  select: boolean;
}

export type FilesToOpen = {
  [fileId: string]: OpenFileOptions;
};

export interface OpenFilesOptions {
  closeAllOtherFileGroups?: boolean;
  closeAllOtherFiles?: boolean;
  resizeFileGroupOneCommentPanel?: boolean;
}

export function isFileGroupCount(
  fileGroup: FileGroupCount | FlipToOpenFileGroup
): fileGroup is FileGroupCount {
  return typeof fileGroup === "number";
}
