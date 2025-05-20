import { BrowserWindow } from "electron";
import https from "https";
import { EventSource } from "eventsource";
import { Agent as UndiciAgent } from "undici";

export interface ElectronAppState {
  readonly mainWindow: BrowserWindow;
  readonly baseUrl: string;
  readonly httpsAgent: https.Agent;
  readonly httpsDispatcher: UndiciAgent;
  readonly eventSources: Map<string, EventSource>;
}
