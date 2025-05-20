import { BrowserWindow } from "electron";
import https from "https";
import { EventSource } from "eventsource";
import { Agent as UndiciAgent } from "undici";
import { WorkspaceWatcher } from "./local_file_system";

export interface FileStats {
  size: number;
  mtime: Date;
  ctime: string;
  birthtime: string;
  isDirectory: boolean;
  mimeType: string | null;
  path: string;
}

export interface LocalFile {
  contentHash: string;
  absolutePath: string;
  pathRelativeToWorkspace: string[];
  name: string;
}

export interface LocalFolder {
  absolutePath: string;
  pathRelativeToWorkspace: string[]; // Last segment is the folder name
}

export interface ElectronAppState {
  readonly mainWindow: BrowserWindow;
  readonly baseUrl: string;
  readonly httpsAgent: https.Agent;
  readonly httpsDispatcher: UndiciAgent;
  readonly eventSources: Map<string, EventSource>;
  readonly workspaceWatchers: Map<string, WorkspaceWatcher>;
}
