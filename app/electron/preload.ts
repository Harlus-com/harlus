import { contextBridge, ipcRenderer } from "electron";
import { LocalFile, LocalFolder } from "./electron_types";
console.log("PRELOAD");

contextBridge.exposeInMainWorld("electron", {
  openDirectoryDialog: () => ipcRenderer.invoke("open-directory-dialog"),
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
  upload: (localFile: LocalFile, workspaceId: string, authHeader: string) =>
    ipcRenderer.invoke("server-upload", localFile, workspaceId, authHeader),
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
  watchWorkspace: (workspacePath: string) =>
    ipcRenderer.invoke("watch-workspace", workspacePath),
  unwatchWorkspace: (workspacePath: string) =>
    ipcRenderer.invoke("unwatch-workspace", workspacePath),
  onLocalFileSystemChange: (callback: (event: any) => void) =>
    ipcRenderer.on("local-file-system-change", (_, event) => {
      console.log("PRELOAD onLocalFileSystemChange", event);
      callback(event);
    }),
  moveItem: (oldAbsolutePath: string, newAbsolutePathParts: string[]) =>
    ipcRenderer.invoke("move-item", oldAbsolutePath, newAbsolutePathParts),
  createFolder: (parentFolder: LocalFolder, newFolderName: string) =>
    ipcRenderer.invoke("create-folder", parentFolder, newFolderName),
  createFile: (
    workspaceLocalDir: string,
    relativeDestPath: string,
    fileName: string,
    data: Buffer
  ) =>
    ipcRenderer.invoke(
      "create-file",
      workspaceLocalDir,
      relativeDestPath,
      fileName,
      data
    ),
  deleteItem: (item: LocalFile | LocalFolder) =>
    ipcRenderer.invoke("delete-item", item),
  ensureFile: (dir: string, subpath: string, name: string) =>
    ipcRenderer.invoke("ensure-file", dir, subpath, name),
  downloadPdfFromUrl: (
    downloadUrl: string,
    localFilePath: string,
    authHeader?: string
  ) =>
    ipcRenderer.invoke(
      "download-pdf-from-url",
      downloadUrl,
      localFilePath,
      authHeader
    ),
  splitPath: (path: string) => ipcRenderer.invoke("split-path", path),
});
