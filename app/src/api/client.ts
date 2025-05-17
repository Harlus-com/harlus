import { authClientWrapper } from "@/api/auth_client_wrapper";

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

  async upload(filePath: string, workspaceId: string) {
    throw new Error("Not implemented");
  }

  abstract getBaseUrl(): Promise<string>;
}

class LocalClient extends BaseWebClient {
  constructor(private readonly baseUrl: string) {
    super();
  }

  async getBaseUrl(): Promise<string> {
    return Promise.resolve(this.baseUrl);
  }
}

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
  override async upload(filePath: string, workspaceId: string) {
    const authHeader = await this.getAuthHeader();
    const data = await this.electron.upload(filePath, workspaceId, authHeader);
    console.log(`UPLOAD ${filePath} Response`, data);
    return data;
  }

  private async getAuthHeader(): Promise<string> {
    const client = authClientWrapper.getClient();
    const authHeader = client.defaults.headers.Authorization;
    if (typeof authHeader !== "string") {
      throw new Error("Auth header is not a string");
    }
    return authHeader;
  }
}

/**
 * Proxies all requests to the electron app -- this allows passing a custom certificate to the server.
 *
 * Note: I don't think we'll need to do this, but leaving this option in place, incase we decide we want to do so in the future.
 */
class ElectronProxyClient implements ServerClient {
  constructor(private readonly electron: ElectronAPI) {}

  private async getAuthHeader(): Promise<string> {
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

  async upload(filePath: string, workspaceId: string) {
    const authHeader = await this.getAuthHeader();
    const data = await this.electron.upload(filePath, workspaceId, authHeader);
    console.log(`UPLOAD ${filePath} Response`, data);
    return data;
  }
}

export const client: ServerClient = window.electron
  ? new ElectronProxyClient(window.electron)
  : new LocalClient("http://localhost:8000");
