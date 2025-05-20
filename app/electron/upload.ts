import fs from "fs";
import path from "path";
import axios from "axios";
import FormData from "form-data";
import https from "https";
import { ElectronAppState } from "./electron_types";

export class Uploader {
  constructor(private readonly state: ElectronAppState) {}
  async upload(filePath: string, workspaceId: string, authHeader: string) {
    console.log("upload", filePath, workspaceId);
    const results = [];
    let st = await fs.promises.stat(filePath);
    if (st.isDirectory()) {
      console.log("uploading directory", filePath);
      const baseDir = path.basename(filePath);
      console.log("baseDir", baseDir);
      const allFilePaths = await this.walk(filePath);
      for (const p of allFilePaths) {
        const relativeDir = path.relative(filePath, p).split(path.sep);
        const fileName = relativeDir.pop(); // Remove the file name
        if (!fileName || fileName.startsWith(".")) {
          continue;
        }
        const appDir = [baseDir, ...relativeDir];
        console.log("appDir", appDir);
        results.push(await this.uploadFile(p, appDir, workspaceId, authHeader));
      }
    } else {
      console.log("uploading file", filePath);
      results.push(
        await this.uploadFile(filePath, [], workspaceId, authHeader)
      );
    }
    return results;
  }

  private async walk(dir: string): Promise<string[]> {
    let results: string[] = [];
    for (const name of await fs.promises.readdir(dir)) {
      const full = path.join(dir, name);
      const st = await fs.promises.stat(full);
      if (st.isDirectory()) {
        results = results.concat(await this.walk(full));
      } else {
        results.push(full);
      }
    }
    return results;
  }

  private async uploadFile(
    filePath: string,
    appDir: string[],
    workspaceId: string,
    authHeader: string
  ) {
    const form = new FormData();
    form.append("workspaceId", workspaceId);
    form.append("appDir", JSON.stringify(appDir));
    form.append("file", fs.createReadStream(filePath), {
      filename: path.basename(filePath),
      contentType: "application/octet-stream",
    });

    const url = `${this.state.baseUrl}/file/upload`;
    const resp = await axios.post(url, form, {
      headers: {
        ...form.getHeaders(),
        Authorization: authHeader,
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      httpsAgent: this.state.httpsAgent,
    });

    return resp.data;
  }
}
