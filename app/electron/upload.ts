import fs from "fs";
import path from "path";
import axios from "axios";
import FormData from "form-data";
import { ElectronAppState, LocalFile } from "./electron_types";

export class Uploader {
  constructor(private readonly state: ElectronAppState) {}

  async upload(localFile: LocalFile, workspaceId: string, authHeader: string) {
    console.log("upload", localFile, workspaceId);
    const filePath = localFile.absolutePath;
    const appDir = localFile.pathRelativeToWorkspace;
    const contentHash = localFile.contentHash;

    const form = new FormData();
    form.append("workspaceId", workspaceId);
    form.append("appDir", JSON.stringify(appDir));
    form.append("contentHash", contentHash);

    const fileStream = fs.createReadStream(filePath);
    const stats = await fs.promises.stat(filePath);
    let uploadedBytes = 0;

    const throttledLog = new ThrottledLogger(100);
    fileStream.on("data", (chunk) => {
      uploadedBytes += chunk.length;
      const progress = (uploadedBytes / stats.size) * 100;
      throttledLog.log(`Upload progress: ${progress.toFixed(2)}%`);
      if (progress == 100) {
        console.log("Upload complete");
      }
    });

    form.append("file", fileStream, {
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

class ThrottledLogger {
  private lastTime = 0;
  constructor(private readonly maxRateMs: number) {}

  log(...args: any[]) {
    const now = Date.now();
    if (now - this.lastTime > this.maxRateMs) {
      console.log(...args);
      this.lastTime = now;
    }
  }
}
