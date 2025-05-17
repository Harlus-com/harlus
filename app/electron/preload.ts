import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electron", {
  openFileDialog: () => ipcRenderer.invoke("open-file-dialog"),
  getFileContent: (filePath: string) =>
    ipcRenderer.invoke("get-file-content", filePath),
  getServerPort: () => 8000,
  //getServerHost: () => "http://127.0.0.1",
  getServerHost: () => "http://harlus-api-dev.eastus.azurecontainer.io",
  getFileStats: (filePath: string) =>
    ipcRenderer.invoke("get-file-stats", filePath),
  get: (path: string, authHeader: string) =>
    ipcRenderer.invoke("server-get", path, authHeader),
  getBuffer: (path: string, authHeader: string) =>
    ipcRenderer.invoke("server-get-buffer", path, authHeader),
  post: (path: string, body: any, authHeader: string) =>
    ipcRenderer.invoke("server-post", path, body, authHeader),
  delete: (path: string, authHeader: string) =>
    ipcRenderer.invoke("server-delete", path, authHeader),
  upload: (filePath: string, workspaceId: string, authHeader: string) =>
    ipcRenderer.invoke("server-upload", filePath, workspaceId, authHeader),
});
