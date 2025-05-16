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

  async get(path: string) {
    const data = await this.electron.get(path);
    console.log(`GET ${path} Response`, data);
    return data;
  }

  async getBuffer(path: string) {
    const data = await this.electron.getBuffer(path);
    console.log(`GET ${path} Response`, data);
    return data;
  }

  async post(path: string, body: any) {
    const data = await this.electron.post(path, body);
    console.log(`POST ${path} Response`, data);
    return data;
  }

  async delete(path: string) {
    const data = await this.electron.delete(path);
    console.log(`DELETE ${path} Response`, data);
    return data;
  }

  async upload(filePath: string, workspaceId: string) {
    const data = await this.electron.upload(filePath, workspaceId);
    console.log(`UPLOAD ${filePath} Response`, data);
    return data;
  }
}

export const client: ServerClient = window.electron
  ? new ElectronClient(window.electron)
  : new LocalClient("http://localhost:8000");
