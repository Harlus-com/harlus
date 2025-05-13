import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import mime from "mime";

const logPath = "/tmp/harlus.txt"; // TODO: Put this somewhere more acceptable and cross-platform enabled
const logStream = fs.createWriteStream(logPath, { flags: "a" });
console.log = (...args) => {
  logStream.write(`[LOG] ${args.join(" ")}\n`);
};
console.error = (...args) => {
  logStream.write(`[ERROR] ${args.join(" ")}\n`);
};

console.log("Starting Electron app");

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

  mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function startApi() {
  console.log("startApi");
  const userDataPath = app.getPath("userData");
  console.log("userDataPath", userDataPath);

  const serverBinary = path.join(
    process.resourcesPath,
    "server",
    "fastapi-server"
  );

  console.log("serverBinary", serverBinary);

  const apiProcess = spawn(serverBinary, ["--port", "8002"], {
    env: {
      APP_DATA_PATH: userDataPath,
    },
  });
  apiProcess.stdout.on("data", (data) => {
    console.log(`[API STDOUT]: ${data}`);
  });

  apiProcess.stderr.on("data", (data) => {
    console.error(`[API STDERR]: ${data}`);
  });

  apiProcess.on("exit", (code, signal) => {
    console.log(`API process exited with code ${code} and signal ${signal}`);
  });

  apiProcess.on("error", (error) => {
    console.error("Error starting API:", error);
  });

  childProcesses.push(apiProcess);
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

  // Get file content (for PDFs, we'll handle this differently in the renderer)
  ipcMain.handle("get-file-content", async (_, filePath) => {
    try {
      const content = fs.readFileSync(filePath);
      return content;
    } catch (error) {
      console.error("Error reading file:", error);
      return null;
    }
  });

  // Add more handlers for API communication here
}

// App lifecycle handlers
app.whenReady().then(() => {
  console.log("whenReady");
  setupIPCHandlers();
  createWindow();
  startApi();

  app.on("activate", () => {
    console.log("activate");
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  app.quit();
});

app.on("will-quit", () => {
  childProcesses.forEach((process) => {
    process.kill();
  });
});
