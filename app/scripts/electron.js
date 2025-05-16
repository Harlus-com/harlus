import electron from "electron";
const { app, BrowserWindow, ipcMain } = electron;
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import mime from "mime";
import axios from "axios";
import FormData from "form-data";
import https from "https";

// Runs an electron app against a local Vite dev server
const args = process.argv;
const useRemoteServer = args.find((arg) => arg === "--remote-server");
console.log("USE REMOTE SERVER", useRemoteServer);
const baseUrl = useRemoteServer
  ? "https://harlus-api-dev.eastus.azurecontainer.io"
  : "http://127.0.0.1:8000";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../../");
const tlsDir = path.join(projectRoot, "infra/nginx-mtls/tls");

const httpsAgent = new https.Agent({
  cert: fs.readFileSync(path.join(tlsDir, "client.crt")),
  key: fs.readFileSync(path.join(tlsDir, "client.key")),
  ca: fs.readFileSync(path.join(tlsDir, "ca.crt")),
});

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.loadURL("http://localhost:8080");
  mainWindow.webContents.openDevTools();
}

async function upload(filePath, workspaceId) {
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
      if (fileName.startsWith(".")) {
        continue;
      }
      const appDir = [baseDir, ...relativeDir];
      console.log("appDir", appDir);
      results.push(await uploadFile(p, appDir, workspaceId));
    }
  } else {
    console.log("uploading file", filePath);
    results.push(await uploadFile(filePath, [], workspaceId));
  }
  return results;
}

async function walk(dir) {
  let results = [];
  for (let name of await fs.promises.readdir(dir)) {
    let full = path.join(dir, name);
    let st = await fs.promises.stat(full);
    if (st.isDirectory()) {
      results = results.concat(await walk(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

async function uploadFile(filePath, appDir, workspaceId) {
  const form = new FormData();
  form.append("workspaceId", workspaceId);
  form.append("appDir", JSON.stringify(appDir));
  form.append("file", fs.createReadStream(filePath), {
    filename: path.basename(filePath),
    contentType: "application/octet-stream",
  });
  // This is hard coded because http://localhost:8000 fails for some reason

  const url = `${baseUrl}/file/upload`;
  const resp = await axios.post(url, form, {
    headers: form.getHeaders(),
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    httpsAgent,
  });

  return resp.data;
}

// IPC handlers for file operations
function setupIPCHandlers() {
  // Get file content (for PDFs, we'll handle this differently in the renderer)
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

  // Server API handlers
  ipcMain.handle("server-get", async (_, path) => {
    const url = `${baseUrl}${path}`;
    const response = await axios.get(url, { httpsAgent });
    return response.data;
  });

  ipcMain.handle("server-get-buffer", async (_, path) => {
    const url = `${baseUrl}${path}`;
    const response = await axios.get(url, {
      httpsAgent,
      responseType: "arraybuffer",
    });
    return response.data;
  });

  ipcMain.handle("server-post", async (_, path, body) => {
    const url = `${baseUrl}${path}`;
    const response = await axios.post(url, body, {
      httpsAgent,
      headers: {
        "Content-Type": "application/json",
      },
    });
    return response.data;
  });

  ipcMain.handle("server-delete", async (_, path) => {
    const url = `${baseUrl}${path}`;
    const response = await axios.delete(url, { httpsAgent });
    return response.data;
  });

  ipcMain.handle("server-upload", async (_, filePath, workspaceId) => {
    return upload(filePath, workspaceId);
  });
}

const childProcesses = [];

app.whenReady().then(() => {
  createWindow();
  setupIPCHandlers();

  app.on("activate", () => {
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
