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
  contentHash: string;
  absolutePath: string;
  pathRelativeToWorkspace: string[];
  name: string;
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
    filePath: string,
    workspaceId: string,
    authHeader: string
  ) => Promise<void>;
  closeEventSource: (eventSourceId: string) => void;
  createEventSource: (url: string) => Promise<string>;
  attachEventForwarder: (callback: (event: any) => void) => void;
  addEventListener: (eventSourceId: string, eventName: string) => void;
  getLocalFiles: (localDir: string) => Promise<LocalFile[]>;
  getLocalFolders: (localDir: string) => Promise<LocalFolder[]>;
}

declare interface Window {
  electron?: ElectronAPI;
}
