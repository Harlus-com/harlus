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

interface ServerClient {
  get: (path: string) => Promise<any>;
  post: (path: string, body: any) => Promise<any>;
  getBuffer: (path: string) => Promise<ArrayBuffer>;
  delete: (path: string) => Promise<any>;
  upload: (filePath: string, workspaceId: string) => Promise<void>;
}

interface ElectronAPI extends ServerClient {
  getFileContent: (path: string) => Promise<ArrayBuffer | null>;
  getFileStats: (path: string) => Promise<FileStats | null>;
  getServerPort: () => number;
  getServerHost: () => string;
}

declare interface Window {
  electron?: ElectronAPI;
}
