const { contextBridge, ipcRenderer } = require("electron");

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electron", {
  openFileDialog: () => ipcRenderer.invoke("open-file-dialog"),
  getFileContent: (filePath) =>
    ipcRenderer.invoke("get-file-content", filePath),
  getFileStats: (filePath) => ipcRenderer.invoke("get-file-stats", filePath),
  get: (path) => ipcRenderer.invoke("server-get", path),
  getBuffer: (path) => ipcRenderer.invoke("server-get-buffer", path),
  post: (path, body) => ipcRenderer.invoke("server-post", path, body),
  delete: (path) => ipcRenderer.invoke("server-delete", path),
  upload: (filePath, workspaceId) =>
    ipcRenderer.invoke("server-upload", filePath, workspaceId),
});
