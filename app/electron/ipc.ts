import fs from "fs";
import { ipcMain, dialog } from "electron";
import mime from "mime";
import axios from "axios";
import { EventSource } from "eventsource";
import { ElectronAppState, LocalFile, LocalFolder } from "./electron_types";
import { Uploader } from "./upload";
import {
  getLocalFiles,
  getLocalFolders,
  moveItem,
  WorkspaceWatcher,
} from "./local_file_system";

export function setupIpcHandlers(electronAppState: ElectronAppState) {
  const { mainWindow, baseUrl, httpsAgent, httpsDispatcher, eventSources } =
    electronAppState;

  ipcMain.handle("open-directory-dialog", async () => {
    const { filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ["openDirectory"],
    });

    return filePaths[0] || null;
  });

  ipcMain.handle("get-file-stats", async (_, filePath) => {
    try {
      const stats = await fs.promises.stat(filePath);
      return {
        path: filePath,
        size: stats.size,
        mtime: stats.mtime,
        ctime: stats.ctime,
        birthtime: stats.birthtime,
        isDirectory: stats.isDirectory(),
        mimeType: mime.getType(filePath) || null,
      };
    } catch (error) {
      console.error("Error getting file stats:", error);
      return null;
    }
  });

  ipcMain.handle("get-file-content", async (_, filePath) => {
    try {
      console.log("getting file content", filePath);
      const content = await fs.promises.readFile(filePath);
      return content;
    } catch (error) {
      console.error("Error reading file:", error);
      return null;
    }
  });

  ipcMain.handle("server-get", async (_, path: string, authHeader: string) => {
    const url = `${baseUrl}${path}`;
    const response = await axios.get(url, {
      httpsAgent,
      headers: {
        Authorization: authHeader,
      },
    });
    return response.data;
  });

  ipcMain.handle(
    "server-get-buffer",
    async (_, path: string, authHeader: string) => {
      const url = `${baseUrl}${path}`;
      const response = await axios.get(url, {
        httpsAgent,
        responseType: "arraybuffer",
        headers: {
          Authorization: authHeader,
        },
      });
      return response.data;
    }
  );

  ipcMain.handle(
    "server-post",
    async (_, path: string, body: any, authHeader: string) => {
      const url = `${baseUrl}${path}`;
      const response = await axios.post(url, body, {
        httpsAgent,
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
      });
      return response.data;
    }
  );

  ipcMain.handle(
    "server-delete",
    async (_, path: string, authHeader: string) => {
      const url = `${baseUrl}${path}`;
      const response = await axios.delete(url, {
        httpsAgent,
        headers: {
          Authorization: authHeader,
        },
      });
      return response.data;
    }
  );

  ipcMain.handle(
    "server-upload",
    (_, localFile: LocalFile, workspaceId: string, authHeader: string) => {
      return new Uploader(electronAppState).upload(
        localFile,
        workspaceId,
        authHeader
      );
    }
  );

  ipcMain.handle("get-base-url", () => {
    return baseUrl;
  });

  ipcMain.handle("add-event-listener", async (_, eventSourceId, eventName) => {
    const eventSource = eventSources.get(eventSourceId);
    if (eventSource) {
      eventSource.addEventListener(eventName, (event: any) => {
        mainWindow.webContents.send("event-forwarder", {
          eventSourceId,
          type: eventName,
          data: event.data,
        });
      });
    }
  });

  const fetchWithMtls = (url: string | URL, init: any) =>
    fetch(url, { ...init, dispatcher: httpsDispatcher });

  ipcMain.handle("create-event-source", async (_, url) => {
    const eventSourceId = Math.random().toString(36).substring(7);
    const eventSource = new EventSource(url, {
      fetch: fetchWithMtls,
    });
    eventSources.set(eventSourceId, eventSource);
    return eventSourceId;
  });

  ipcMain.handle("close-event-source", async (_, eventSourceId) => {
    const eventSource = eventSources.get(eventSourceId);
    if (eventSource) {
      eventSource.close();
      eventSources.delete(eventSourceId);
    }
  });

  ipcMain.handle("get-local-files", async (_, localDir: string) => {
    return getLocalFiles(localDir);
  });

  ipcMain.handle("get-local-folders", async (_, localDir: string) => {
    return getLocalFolders(localDir);
  });

  ipcMain.handle("watch-workspace", async (_, workspacePath: string) => {
    const watcher = new WorkspaceWatcher(
      (event: any) =>
        mainWindow.webContents.send("local-file-system-change", event),
      workspacePath
    );
    watcher.start();
    electronAppState.workspaceWatchers.set(workspacePath, watcher);
  });

  ipcMain.handle("unwatch-workspace", async (_, workspacePath: string) => {
    const watcher = electronAppState.workspaceWatchers.get(workspacePath);
    if (watcher) {
      watcher.stop();
      electronAppState.workspaceWatchers.delete(workspacePath);
    }
  });

  ipcMain.handle(
    "move-item",
    async (_, item: LocalFile | LocalFolder, newRelativePath: string[]) => {
      return moveItem(item, newRelativePath);
    }
  );
}
