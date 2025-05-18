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
}

declare interface Window {
  electron?: ElectronAPI;
}
