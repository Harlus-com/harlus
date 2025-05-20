import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electron", {
  openFileDialog: () => ipcRenderer.invoke("open-file-dialog"),
  getFileContent: (filePath: string) =>
    ipcRenderer.invoke("get-file-content", filePath),
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
  getBaseUrl: () => ipcRenderer.invoke("get-base-url"),
  attachEventForwarder: (callback: (event: any) => void) =>
    ipcRenderer.on("event-forwarder", (_, event) => callback(event)),
  createEventSource: (url: string) =>
    ipcRenderer.invoke("create-event-source", url),
  addEventListener: (eventSourceId: string, eventName: string) =>
    ipcRenderer.invoke("add-event-listener", eventSourceId, eventName),
  closeEventSource: (eventSourceId: string) =>
    ipcRenderer.invoke("close-event-source", eventSourceId),
  getLocalFiles: (localDir: string) =>
    ipcRenderer.invoke("get-local-files", localDir),
  getLocalFolders: (localDir: string) =>
    ipcRenderer.invoke("get-local-folders", localDir),
});
