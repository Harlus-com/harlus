import { authClientWrapper } from "@/api/auth_client_wrapper";

class LocalClient implements ServerClient {
  constructor(private readonly baseUrl: string) {}

  async get(path: string) {
    const client = authClientWrapper.getClient();
    const response = await client.get(`${this.baseUrl}${path}`);
    console.log(`GET ${path} Response`, response.data);
    return response.data;
  }

  async getBuffer(path: string) {
    const client = authClientWrapper.getClient();
    const response = await client.get(`${this.baseUrl}${path}`, {
      responseType: "arraybuffer",
    });
    return response.data;
  }

  async post(path: string, body: any) {
    const client = authClientWrapper.getClient();
    const response = await client.post(`${this.baseUrl}${path}`, body);
    console.log(`POST ${path} Response`, response.data);
    return response.data;
  }

  async delete(path: string) {
    const client = authClientWrapper.getClient();
    const response = await client.delete(`${this.baseUrl}${path}`);
    console.log(`DELETE ${path} Response`, response.data);
    return response.data;
  }

  async upload(filePath: string, workspaceId: string) {
    throw new Error("Not implemented");
  }
}

class ElectronClient implements ServerClient {
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
  ? new ElectronClient(window.electron)
  : new LocalClient("http://localhost:8000");
