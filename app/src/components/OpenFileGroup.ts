import { WorkspaceFile } from "@/api/types";

export class OpenFileGroup {
  constructor(
    readonly files: { [key: string]: WorkspaceFile },
    readonly fileOrder: Set<string>,
    readonly selectedFile: WorkspaceFile | null,
    readonly showComments: { [key: string]: boolean }
  ) {}

  toggleShowComments(fileId: string) {
    const newShowComments = { ...this.showComments };
    newShowComments[fileId] = !newShowComments[fileId];
    return new OpenFileGroup(
      this.files,
      this.fileOrder,
      this.selectedFile,
      newShowComments
    );
  }

  addFile(
    file: WorkspaceFile,
    options: { select: boolean; showComments?: boolean }
  ) {
    const newFiles = this.shallowCopyFiles();
    newFiles[file.id] = file;
    const newFileOrder = this.shallowCopyFileOrder();
    newFileOrder.add(file.id);
    const newSelectedFile = options.select ? file : this.selectedFile;
    const newShowComments = { ...this.showComments };
    newShowComments[file.id] = !!options.showComments;
    return new OpenFileGroup(
      newFiles,
      newFileOrder,
      newSelectedFile,
      newShowComments
    );
  }

  removeFile(fileId: string) {
    const newFiles = this.shallowCopyFiles();
    delete newFiles[fileId];
    const newFileOrder = this.shallowCopyFileOrder();
    newFileOrder.delete(fileId);
    const currentSelectedFile =
      this.selectedFile?.id === fileId ? null : this.selectedFile;
    const newSelectedFileId =
      currentSelectedFile?.id || OpenFileGroup.firstOrNull(newFileOrder);
    const newSelectedFile =
      newSelectedFileId === null ? null : newFiles[newSelectedFileId] || null;
    return new OpenFileGroup(
      newFiles,
      newFileOrder,
      newSelectedFile,
      this.showComments
    );
  }

  setSelectedFile(file: WorkspaceFile) {
    if (this.files[file.id] === undefined) {
      throw new Error(
        "Cannot set selected file to non-existent file (not found in file map)"
      );
    }
    if (!this.fileOrder.has(file.id)) {
      throw new Error(
        "Cannot set selected file to non-existent file (not found in order)"
      );
    }
    return new OpenFileGroup(
      this.shallowCopyFiles(),
      this.shallowCopyFileOrder(),
      file,
      this.showComments
    );
  }

  private shallowCopyFiles() {
    return Object.fromEntries(
      Array.from(this.fileOrder).map((id) => [id, this.files[id]])
    );
  }

  private shallowCopyFileOrder() {
    return new Set<string>(this.fileOrder);
  }

  private static firstOrNull(fileOrder: Set<string>) {
    return Array.from(fileOrder).length > 0 ? Array.from(fileOrder)[0] : null;
  }

  static empty() {
    return new OpenFileGroup({}, new Set(), null, {});
  }
}
