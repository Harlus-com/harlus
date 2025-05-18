const { contextBridge, ipcRenderer } = require("electron");

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electron", {
  openFileDialog: () => ipcRenderer.invoke("open-file-dialog"),
  getFileContent: (filePath) =>
    ipcRenderer.invoke("get-file-content", filePath),
  getFileStats: (filePath) => ipcRenderer.invoke("get-file-stats", filePath),
  get: (path, authHeader) => ipcRenderer.invoke("server-get", path, authHeader),
  getBuffer: (path, authHeader) =>
    ipcRenderer.invoke("server-get-buffer", path, authHeader),
  post: (path, body, authHeader) =>
    ipcRenderer.invoke("server-post", path, body, authHeader),
  delete: (path, authHeader) =>
    ipcRenderer.invoke("server-delete", path, authHeader),
  upload: (filePath, workspaceId, authHeader) =>
    ipcRenderer.invoke("server-upload", filePath, workspaceId, authHeader),
  getBaseUrl: () => ipcRenderer.invoke("get-base-url"),
  createEventSource: (url) => ipcRenderer.invoke("create-event-source", url),
  attachEventForwarder: (callback) => {
    ipcRenderer.on("event-forwarder", (_, event) => {
      console.log("Event forwarder time", Date.now());
      callback(event);
    });
  },
  addEventListener: (eventSourceId, eventName) =>
    ipcRenderer.invoke("add-event-listener", eventSourceId, eventName),
  closeEventSource: (eventSourceId) =>
    ipcRenderer.invoke("close-event-source", eventSourceId),
});
