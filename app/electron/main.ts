import fs from "fs";
import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "path";
import mime from "mime";
import axios from "axios";
import FormData from "form-data";
import https from "https";
import { interactiveLogin } from "./auth";
import express from "express";

const logPath = "/tmp/harlus.txt"; // TODO: Put this somewhere more acceptable and cross-platform enabled
const logStream = fs.createWriteStream(logPath, { flags: "a" });
console.log = (...args) => {
  logStream.write(`[LOG] ${args.join(" ")}\n`);
};
console.error = (...args) => {
  logStream.write(`[ERROR] ${args.join(" ")}\n`);
};

//const baseUrl = "http://127.0.0.1:8000";
const baseUrl = "https://harlus-api-dev.eastus.azurecontainer.io";

// TLS configuration
const tlsDir = path.join(process.resourcesPath, "tls");

const httpsAgent = new https.Agent({
  cert: fs.readFileSync(path.join(tlsDir, "client.crt")),
  key: fs.readFileSync(path.join(tlsDir, "client.key")),
  ca: fs.readFileSync(path.join(tlsDir, "ca.crt")),
});

// Keep a global reference of the window object to avoid garbage collection
let mainWindow: BrowserWindow | null = null;
const childProcesses: any[] = [];

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 400,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  //mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  mainWindow.loadURL("http://localhost:8080");
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

async function walk(dir: string): Promise<string[]> {
  let results: string[] = [];
  for (const name of await fs.promises.readdir(dir)) {
    const full = path.join(dir, name);
    const st = await fs.promises.stat(full);
    if (st.isDirectory()) {
      results = results.concat(await walk(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

async function uploadFile(
  filePath: string,
  appDir: string[],
  workspaceId: string,
  authHeader: string
) {
  const form = new FormData();
  form.append("workspaceId", workspaceId);
  form.append("appDir", JSON.stringify(appDir));
  form.append("file", fs.createReadStream(filePath), {
    filename: path.basename(filePath),
    contentType: "application/octet-stream",
  });

  const url = `${baseUrl}/file/upload`;
  const resp = await axios.post(url, form, {
    headers: {
      ...form.getHeaders(),
      Authorization: authHeader,
    },
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    httpsAgent,
  });

  return resp.data;
}

// IPC handlers for file operations
function setupIPCHandlers() {
  // Handle file opening dialog
  ipcMain.handle("open-file-dialog", async () => {
    if (!mainWindow) return [];

    const { filePaths } = await dialog.showOpenDialog(mainWindow, {
      properties: ["openFile", "multiSelections"],
      filters: [{ name: "PDF Documents", extensions: ["pdf"] }],
    });

    return filePaths;
  });

  // Get file stats
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

  // Get file content
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

  // Server API handlers
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
    async (_, filePath: string, workspaceId: string, authHeader: string) => {
      console.log("upload", filePath, workspaceId);
      const results = [];
      let st = await fs.promises.stat(filePath);
      if (st.isDirectory()) {
        console.log("uploading directory", filePath);
        const baseDir = path.basename(filePath);
        console.log("baseDir", baseDir);
        const allFilePaths = await walk(filePath);
        for (const p of allFilePaths) {
          const relativeDir = path.relative(filePath, p).split(path.sep);
          const fileName = relativeDir.pop(); // Remove the file name
          if (!fileName || fileName.startsWith(".")) {
            continue;
          }
          const appDir = [baseDir, ...relativeDir];
          console.log("appDir", appDir);
          results.push(await uploadFile(p, appDir, workspaceId, authHeader));
        }
      } else {
        console.log("uploading file", filePath);
        results.push(await uploadFile(filePath, [], workspaceId, authHeader));
      }
      return results;
    }
  );

  let token: string | null = null;
  ipcMain.handle("msal-login", async () => {
    token = await interactiveLogin();
    return token;
  });

  ipcMain.handle("msal-get-token", async () => {
    return token;
  });
}

// App lifecycle handlers
app.whenReady().then(() => {
  console.log("whenReady");
  setupIPCHandlers();
  console.log("setupIPCHandlers");
  //createWindow();
  startUiServer();

  app.on("activate", () => {
    console.log("activate");
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  childProcesses.forEach((process) => {
    process.kill();
  });
  app.quit();
});

function startUiServer() {
  console.log("starting ui server");
  const DIST = path.join(__dirname, "../dist");
  const httpApp = express();
  console.log("DIST", DIST);
  // Serve all files in your dist folder
  httpApp.use(express.static(DIST));
  console.log("httpApp.use(express.static(DIST))");
  // For any other route, serve index.html (SPA client‐side routing)
  httpApp.get("/*", (_req: any, res: any) => {
    res.sendFile(path.join(DIST, "index.html"));
  });

  httpApp.listen(8080, () => {
    console.log(`▶️  HTTP server listening on http://localhost:8080`);
    // Now that the server is up, create the BrowserWindow
    createWindow();
  });
}
