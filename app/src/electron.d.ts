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

interface ElectronAPI {
  getFileContent: (path: string) => Promise<ArrayBuffer | null>;
  getFileStats: (path: string) => Promise<FileStats | null>;
  getServerPort: () => number;
  getServerHost: () => string;
  upload: (filePath: string, workspaceId: string) => Promise<void>;
}

declare interface Window {
  electron?: ElectronAPI;
}
