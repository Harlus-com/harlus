class LocalClient implements ServerClient {
  constructor(private readonly baseUrl: string) {}

  async get(path: string) {
    const response = await fetch(`${this.baseUrl}${path}`);
    if (!response.ok) {
      console.error(`GET ${path} failed: ${response}`);
      throw new Error(`GET ${path} failed: ${response.statusText}`);
    }
    const data = await response.json();
    console.log(`GET ${path} Response`, data);
    return data;
  }

  async getBuffer(path: string) {
    const response = await fetch(`${this.baseUrl}${path}`);
    if (!response.ok) {
      console.error(`GET ${path} failed: ${response}`);
      throw new Error(`GET ${path} failed: ${response.statusText}`);
    }
    return response.arrayBuffer();
  }

  async post(path: string, body: any) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      console.error(`POST ${path} failed: ${response}`);
      throw new Error(`POST ${path} failed: ${response.statusText}`);
    }
    const data = await response.json();
    console.log(`POST ${path} Response`, data);
    return data;
  }

  async delete(path: string) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      console.error(`DELETE ${path} failed: ${response}`);
      throw new Error(`DELETE ${path} failed: ${response.statusText}`);
    }
    const data = await response.json();
    console.log(`DELETE ${path} Response`, data);
    return data;
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
