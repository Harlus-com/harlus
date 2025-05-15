const { contextBridge, ipcRenderer } = require("electron");

const serverPortArg = process.argv.find((arg) =>
  arg.startsWith("--server_port=")
);
const serverPort = serverPortArg ? serverPortArg.split("=")[1] : "";
console.log("serverPort", serverPort);

const serverHostArg = process.argv.find((arg) =>
  arg.startsWith("--server_host=")
);
const serverHost = serverHostArg ? serverHostArg.split("=")[1] : "";
console.log("serverHost", serverHost);

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electron", {
  openFileDialog: () => ipcRenderer.invoke("open-file-dialog"),
  getFileContent: (filePath) =>
    ipcRenderer.invoke("get-file-content", filePath),
  getFileStats: (filePath) => ipcRenderer.invoke("get-file-stats", filePath),
  // Add more API methods as needed for your application
  getServerPort: () => serverPort,
  getServerHost: () => serverHost,
});
