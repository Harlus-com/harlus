import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "path";
import fs from "fs";
import mime from "mime";
import axios from "axios";
import FormData from "form-data";
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
  workspaceId: string
) {
  const form = new FormData();
  form.append("workspaceId", workspaceId);
  form.append("appDir", JSON.stringify(appDir));
  form.append("file", fs.createReadStream(filePath), {
    filename: path.basename(filePath),
    contentType: "application/octet-stream",
  });
  const url = "http://harlus-api-dev.eastus.azurecontainer.io/file/upload";
  //const url = "http://127.0.0.1:8000/file/upload";
  const resp = await axios.post(url, form, {
    headers: form.getHeaders(),
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
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

  ipcMain.handle("upload", async (_, { filePath, workspaceId }) => {
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
        results.push(await uploadFile(p, appDir, workspaceId));
      }
    } else {
      console.log("uploading file", filePath);
      results.push(await uploadFile(filePath, [], workspaceId));
    }
    return results;
  });

  // Add more handlers for API communication here
}

// App lifecycle handlers
app.whenReady().then(() => {
  console.log("whenReady");
  setupIPCHandlers();
  createWindow();

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
