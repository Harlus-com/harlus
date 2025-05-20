import fs from "fs";
import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "path";
import mime from "mime";
import axios from "axios";
import FormData from "form-data";
import https from "https";
import express from "express";
import { EventSource } from "eventsource";
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
      };
      setupIpcHandlers(state);
    });

    function createWindow() {
      const mainWindow = new BrowserWindow({
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
      mainWindow.loadURL("http://localhost:8080");
      return mainWindow;
    }
  }
}
