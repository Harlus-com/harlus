import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electron", {
  openFileDialog: () => ipcRenderer.invoke("open-file-dialog"),
  getFileContent: (filePath: string) =>
    ipcRenderer.invoke("get-file-content", filePath),
  getServerPort: () => 8002,
  getFileStats: (filePath: string) =>
    ipcRenderer.invoke("get-file-stats", filePath),
});
