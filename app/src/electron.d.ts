// Type definitions for Electron integration
interface FileStats {
  size: number;
  mtime: Date;
  ctime: string;
  birthtime: string;
  isDirectory: boolean;
  mimeType: string | null;
  path: string;
}

interface LocalFile {
  contentHash: string; // Maps to id in WorkspaceFile
  name: string; // Maps to name in WorkspaceFile (last segment of absolutePath)
  absolutePath: string; // Not represented in WorkspaceFile (This is the path on the local machine)
  pathRelativeToWorkspace: string[]; // Maps to appDir in WorkspaceFile
}

interface LocalFolder {
  absolutePath: string;
  pathRelativeToWorkspace: string[]; // Last segment is the folder name
}

interface ElectronAPI {
  getFileContent: (path: string) => Promise<ArrayBuffer | null>;
  getFileStats: (path: string) => Promise<FileStats | null>;
  getServerPort: () => number;
  getServerHost: () => string;
  getBaseUrl: () => string;
  get: (path: string, authHeader: string) => Promise<any>;
  post: (path: string, body: any, authHeader: string) => Promise<any>;
  getBuffer: (path: string, authHeader: string) => Promise<ArrayBuffer>;
  delete: (path: string, authHeader: string) => Promise<any>;
  upload: (
    localFile: LocalFile,
    workspaceId: string,
    authHeader: string
  ) => Promise<void>;
  closeEventSource: (eventSourceId: string) => void;
  createEventSource: (url: string) => Promise<string>;
  attachEventForwarder: (callback: (event: any) => void) => void;
  addEventListener: (eventSourceId: string, eventName: string) => void;
  getLocalFiles: (localDir: string) => Promise<LocalFile[]>;
  getLocalFolders: (localDir: string) => Promise<LocalFolder[]>;
  watchWorkspace: (workspacePath: string) => void;
  unwatchWorkspace: (workspacePath: string) => void;
  onLocalFileSystemChange: (callback: (event: any) => void) => void;
  openDirectoryDialog: () => Promise<string | null>;
  moveItem: (
    oldAbsolutePath: string,
    newAbsolutePathParts: string[]
  ) => Promise<boolean>;
  createFolder: (
    parentFolder: LocalFolder,
    newFolderName: string
  ) => Promise<boolean>;
  createFile: (
    workspacePath: string,
    relativeFileDir: string,
    fileName: string,
    data: Buffer
  ) => Promise<boolean>;
  deleteItem: (item: LocalFile | LocalFolder) => Promise<boolean>;
  ensureFile: (dir: string, subpath: string, name: string) => Promise<string>;
  downloadPdfFromUrl: (
    downloadUrl: string,
    localFilePath: string,
    authHeader?: string
  ) => Promise<boolean>;
  splitPath: (pathString: string) => Promise<string[]>;
}

declare interface Window {
  electron?: ElectronAPI;
}
