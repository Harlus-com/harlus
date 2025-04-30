const { contextBridge, ipcRenderer } = require("electron");

const serverPort = process.argv
  .find((arg) => arg.startsWith("--server_port="))
  .split("=")[1];
console.log("serverPort", serverPort);

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electron", {
  openFileDialog: () => ipcRenderer.invoke("open-file-dialog"),
  getFileContent: (filePath) =>
    ipcRenderer.invoke("get-file-content", filePath),
  getFileStats: (filePath) => ipcRenderer.invoke("get-file-stats", filePath),
  // Add more API methods as needed for your application
  getServerPort: () => serverPort,
});
