import fs from "fs";
import { app, BrowserWindow } from "electron";
import path from "path";
import https from "https";
import express from "express";
import { Agent as UndiciAgent } from "undici";
import { ElectronAppState } from "./electron_types";
import { setupIpcHandlers } from "./ipc";

export abstract class ElectronApp {
  abstract runPrescripts(): void;

  abstract getBaseUrl(): string;

  abstract getTlsDir(): string;

  abstract startUiServer(): Promise<void>;

  abstract onWindowReady(mainWindow: BrowserWindow): void;

  start() {
    this.runPrescripts();
    const baseUrl = this.getBaseUrl();
    const tlsDir = this.getTlsDir();
    const httpsAgent = new https.Agent({
      cert: fs.readFileSync(path.join(tlsDir, "client.crt")),
      key: fs.readFileSync(path.join(tlsDir, "client.key")),
      ca: fs.readFileSync(path.join(tlsDir, "ca.crt")),
    });
    const httpsDispatcher = new UndiciAgent({
      connect: {
        ca: fs.readFileSync(path.join(tlsDir, "ca.crt")),
        cert: fs.readFileSync(path.join(tlsDir, "client.crt")),
        key: fs.readFileSync(path.join(tlsDir, "client.key")),
      },
    });

    app.whenReady().then(async () => {
      await this.startUiServer();
      const mainWindow = createWindow();
      this.onWindowReady(mainWindow);
      const state: ElectronAppState = {
        mainWindow,
        baseUrl,
        httpsAgent,
        httpsDispatcher,
        eventSources: new Map(),
        workspaceWatchers: new Map(),
      };
      setupIpcHandlers(state);
    });

    function createWindow() {
      const mainWindow = new BrowserWindow({
        width: 1800,
        height: 1200,
        minWidth: 800,
        minHeight: 400,
        webPreferences: {
          preload: path.join(__dirname, "preload.cjs"),
          contextIsolation: true,
          nodeIntegration: false,
        },
      });
      mainWindow.loadURL("http://localhost:8080");
      return mainWindow;
    }
  }
}

export class ProductionElectronApp extends ElectronApp {
  runPrescripts(): void {
    const logPath = "/tmp/harlus.txt"; // TODO: Put this somewhere more acceptable and cross-platform enabled
    const logStream = fs.createWriteStream(logPath, { flags: "a" });
    console.log = (...args) => {
      logStream.write(`[LOG] ${args.join(" ")}\n`);
    };
    console.error = (...args) => {
      logStream.write(`[ERROR] ${args.join(" ")}\n`);
    };
  }
  getBaseUrl(): string {
    return "https://harlus-api-dev.eastus.azurecontainer.io";
  }
  getTlsDir(): string {
    return path.join(process.resourcesPath, "tls");
  }
  startUiServer(): Promise<void> {
    return new Promise((resolve) => {
      const DIST = path.join(__dirname, "../dist");
      const httpApp = express();
      // Serve all files in your dist folder
      httpApp.use(express.static(DIST));
      // For any other route, serve index.html (SPA client‐side routing)
      httpApp.get("/*", (_req: any, res: any) => {
        res.sendFile(path.join(DIST, "index.html"));
      });
      httpApp.listen(8080, () => {
        console.log(`▶️  HTTP server listening on http://localhost:8080`);
        resolve();
      });
    });
  }
  onWindowReady(mainWindow: BrowserWindow): void {
    // pass
  }
}

export class DevElectronApp extends ElectronApp {
  runPrescripts(): void {
    // pass
  }
  getBaseUrl(): string {
    const args = process.argv;
    const useRemoteServer = !!args.find((arg) => arg === "--remote-server");
    const useLocalDockerSsl = !!args.find((arg) => arg === "--local-docker");
    if (useLocalDockerSsl) {
      console.log(
        "Using local docker with SSL, relying on /etc/hosts to map harlus-api-dev.eastus.azurecontainer.io to localhost"
      );
      return "https://harlus-api-dev.eastus.azurecontainer.io:8000";
    }
    if (useRemoteServer) {
      console.log(
        "Using remote server, make sure /etc/hosts does not override harlus-api-dev.eastus.azurecontainer.io"
      );
      const hosts = fs.readFileSync("/etc/hosts", "utf8");
      console.log("\n#####  Start hosts file  #####");
      console.log(hosts);
      console.log("#####  End of hosts file  #####\n");
      return "https://harlus-api-dev.eastus.azurecontainer.io";
    }
    return "http://127.0.0.1:8000";
  }
  getTlsDir(): string {
    const projectRoot = path.resolve(__dirname, "../../");
    return path.join(projectRoot, "infra/nginx-mtls/tls");
  }
  startUiServer(): Promise<void> {
    return Promise.resolve();
  }
  onWindowReady(mainWindow: BrowserWindow): void {
    mainWindow.webContents.openDevTools();
  }
}
