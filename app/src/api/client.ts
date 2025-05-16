class Client implements ServerClient {
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

const port = window.electron?.getServerPort() || 8000;
const host = window.electron?.getServerHost() || "http://localhost";
//const host = "http://harlus-api-dev.eastus.azurecontainer.io";
console.log("HOST", host);
console.log("PORT", port);
export const BASE_URL = `${host}:${port}`;
export const client: ServerClient =
  window.electron?.getServerClient() || new Client(BASE_URL);
