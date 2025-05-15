import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electron", {
  openFileDialog: () => ipcRenderer.invoke("open-file-dialog"),
  getFileContent: (filePath: string) =>
    ipcRenderer.invoke("get-file-content", filePath),
  getServerPort: () => 8000,
  getServerHost: () => "http://harlus-api-dev.eastus.azurecontainer.io",
  getFileStats: (filePath: string) =>
    ipcRenderer.invoke("get-file-stats", filePath),
  uploadFile: (filePath: string, workspaceId: string) =>
    ipcRenderer.invoke("upload", { filePath, workspaceId }),
});
