import fs from "fs";
import path from "path";
import axios from "axios";
import FormData from "form-data";
import { ElectronAppState, LocalFile } from "./electron_types";

export class Uploader {
  constructor(private readonly state: ElectronAppState) {}
  async upload(localFile: LocalFile, workspaceId: string, authHeader: string) {
    console.log("upload", localFile, workspaceId);
    return this.uploadFile(
      localFile.absolutePath,
      localFile.pathRelativeToWorkspace,
      workspaceId,
      authHeader
    );
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
