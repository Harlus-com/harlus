import { authClientWrapper } from "@/api/auth_client_wrapper";
import {
  ElectronEventSourceClient,
  eventForwarder,
  EventSourceClient,
  WebEventSourceClient,
} from "./event_source_client";

interface ServerClient {
  get: (path: string) => Promise<any>;
  post: (path: string, body: any) => Promise<any>;
  getBuffer: (path: string) => Promise<ArrayBuffer>;
  delete: (path: string) => Promise<any>;
  upload: (localFile: LocalFile, workspaceId: string) => Promise<void>;
  createEventSource: (urlPath: string) => Promise<EventSourceClient>;
  getAuthHeader: () => Promise<string>;
}

abstract class BaseWebClient implements ServerClient {
  async get(path: string) {
    const baseUrl = await this.getBaseUrl();
    const client = authClientWrapper.getClient();
    const response = await client.get(`${baseUrl}${path}`);
    console.log(`GET ${path} Response`, response.data);
    return response.data;
  }

  async getBuffer(path: string) {
    const baseUrl = await this.getBaseUrl();
    const client = authClientWrapper.getClient();
    const response = await client.get(`${baseUrl}${path}`, {
      responseType: "arraybuffer",
    });
    return response.data;
  }

  async post(path: string, body: any) {
    const baseUrl = await this.getBaseUrl();
    const client = authClientWrapper.getClient();
    const response = await client.post(`${baseUrl}${path}`, body);
    console.log(`POST ${path} Response`, response.data);
    return response.data;
  }

  async delete(path: string) {
    const baseUrl = await this.getBaseUrl();
    const client = authClientWrapper.getClient();
    const response = await client.delete(`${baseUrl}${path}`);
    console.log(`DELETE ${path} Response`, response.data);
    return response.data;
  }

  async upload(localFile: LocalFile, workspaceId: string) {
    throw new Error("Not implemented");
  }

  async getAuthHeader(): Promise<string> {
    const client = authClientWrapper.getClient();
    const authHeader = client.defaults.headers.Authorization;
    if (typeof authHeader !== "string") {
      throw new Error("Auth header is not a string");
    }
    return authHeader;
  }

  abstract getBaseUrl(): Promise<string>;

  abstract createEventSource(urlPath: string): Promise<EventSourceClient>;
}

class LocalClient extends BaseWebClient {
  constructor(private readonly baseUrl: string) {
    super();
  }

  async getBaseUrl(): Promise<string> {
    return Promise.resolve(this.baseUrl);
  }

  async createEventSource(urlPath: string): Promise<EventSourceClient> {
    return new WebEventSourceClient(this.baseUrl + urlPath);
  }
}

// ELECTRON CLIENTS
// Right now there are two because we're not sure what our long term approach will need to be based off security.
// Ideally we don't proxy requests through node, but more and more it's looking like that's the model we'll need to have.

/**
 * Client for the electron app. Makes requests directly to the server except for uploading files,
 * because only the node process can access the file system.
 */
class ElectronClient extends BaseWebClient {
  constructor(private readonly electron: ElectronAPI) {
    super();
  }

  override async getBaseUrl(): Promise<string> {
    return this.electron.getBaseUrl();
  }

  /**
   *  Upload still needs to proxy to the electron app in all cases,
   *  because only the node process can access the file system.
   */
  override async upload(localFile: LocalFile, workspaceId: string) {
    const authHeader = await this.getAuthHeader();
    const data = await this.electron.upload(localFile, workspaceId, authHeader);
    console.log(`UPLOAD ${localFile} Response`, data);
    return data;
  }

  async createEventSource(urlPath: string): Promise<EventSourceClient> {
    const baseUrl = await this.getBaseUrl();
    const eventSourceId = await this.electron.createEventSource(
      baseUrl + urlPath
    );
    return new ElectronEventSourceClient(eventSourceId, this.electron);
  }
}

/**
 * Proxies all requests to the electron app -- this allows passing a custom certificate to the server.
 */
class ElectronProxyClient implements ServerClient {
  constructor(private readonly electron: ElectronAPI) {}

  async getAuthHeader(): Promise<string> {
    const client = authClientWrapper.getClient();
    const authHeader = client.defaults.headers.Authorization;
    if (typeof authHeader !== "string") {
      throw new Error("Auth header is not a string");
    }
    return authHeader;
  }

  async get(path: string) {
    const authHeader = await this.getAuthHeader();
    const data = await this.electron.get(path, authHeader);
    console.log(`GET ${path} Response`, data);
    return data;
  }

  async getBuffer(path: string) {
    const authHeader = await this.getAuthHeader();
    const data = await this.electron.getBuffer(path, authHeader);
    console.log(`GET ${path} Response`, data);
    return data;
  }

  async post(path: string, body: any) {
    const authHeader = await this.getAuthHeader();
    const data = await this.electron.post(path, body, authHeader);
    console.log(`POST ${path} Response`, data);
    return data;
  }

  async delete(path: string) {
    const authHeader = await this.getAuthHeader();
    const data = await this.electron.delete(path, authHeader);
    console.log(`DELETE ${path} Response`, data);
    return data;
  }

  async upload(localFile: LocalFile, workspaceId: string) {
    const authHeader = await this.getAuthHeader();
    const data = await this.electron.upload(localFile, workspaceId, authHeader);
    console.log(`UPLOAD ${localFile} Response`, data);
    return data;
  }

  async createEventSource(urlPath: string): Promise<EventSourceClient> {
    const baseUrl = await this.electron.getBaseUrl();
    const eventSourceId = await this.electron.createEventSource(
      baseUrl + urlPath
    );
    return new ElectronEventSourceClient(eventSourceId, this.electron);
  }
}

if (window.electron) {
  window.electron.attachEventForwarder(
    eventForwarder.forward.bind(eventForwarder)
  );
}

export const client: ServerClient = window.electron
  ? new ElectronProxyClient(window.electron)
  : new LocalClient("http://localhost:8000");
