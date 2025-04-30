import electron from "electron";
import { spawn } from "child_process";
const { app, BrowserWindow, ipcMain } = electron;
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import mime from "mime";

// Runs an electron app against a local Vite dev server
const args = process.argv;
const startServer = args.includes("--start_server");
const defualtPort = startServer ? 8001 : 8000;
const serverPort =
  args.find((arg) => arg.startsWith("--server_port="))?.split("=")[1] ||
  defualtPort;
console.log("START SERVER", startServer);
console.log("SERVER PORT", serverPort);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
      additionalArguments: [`--server_port=${serverPort}`],
    },
  });

  mainWindow.loadURL("http://localhost:8080");
  mainWindow.webContents.openDevTools();
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
}

const childProcesses = [];

function startApi() {
  const userDataPath = app.getPath("userData");
  console.log("USER DATA PATH", userDataPath);
  const pythonPath = path.join(__dirname, "../../server/.venv/bin/python3.13");
  const apiProcess = spawn("python3", ["main.py", "--port", serverPort], {
    env: {
      PATH: `${process.env.PATH}:${pythonPath}`,
      APP_DATA_PATH: userDataPath,
    },
    cwd: path.join(__dirname, "../../server"),
  });

  apiProcess.on("error", (error) => {
    console.error("Error starting API:", error);
  });

  childProcesses.push(apiProcess);
}

app.whenReady().then(() => {
  createWindow();
  setupIPCHandlers();
  if (startServer) {
    startApi();
  }

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
