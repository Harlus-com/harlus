import { FileGroupCount } from "@/components/panels";

export interface OpenFileOptions {
  showComments: boolean;
  fileGroup: FileGroupCount;
  select: boolean;
}

export type FilesToOpen = {
  [fileId: string]: OpenFileOptions;
};

export interface OpenFilesOptions {
  closeAllOtherFileGroups?: boolean;
  closeAllOtherFiles?: boolean;
}
