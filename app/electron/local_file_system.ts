import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { LocalFile, LocalFolder } from "./electron_types";

export async function walkFiles(dir: string): Promise<string[]> {
  let results: string[] = [];
  for (const name of await fs.readdir(dir)) {
    const full = path.join(dir, name);
    const st = await fs.stat(full);
    if (st.isDirectory()) {
      results = results.concat(await walkFiles(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

export async function walkFolders(
  dir: string,
  baseDir: string
): Promise<string[]> {
  let results: string[] = [];
  for (const name of await fs.readdir(dir)) {
    const full = path.join(dir, name);
    const st = await fs.stat(full);
    if (st.isDirectory()) {
      results.push(full);
      results = results.concat(await walkFolders(full, baseDir));
    }
  }
  return results;
}

export async function getLocalFiles(localDir: string): Promise<LocalFile[]> {
  const files: LocalFile[] = [];
  const allFilePaths = await walkFiles(localDir);

  for (const filePath of allFilePaths) {
    const content = await fs.readFile(filePath);
    const contentHash = crypto
      .createHash("sha256")
      .update(content)
      .digest("hex");
    const relativePath = path.relative(localDir, filePath).split(path.sep);
    relativePath.pop();
    files.push({
      contentHash,
      absolutePath: filePath,
      pathRelativeToWorkspace: relativePath,
      name: path.basename(filePath),
    });
  }

  return files;
}

export async function getLocalFolders(
  localDir: string
): Promise<LocalFolder[]> {
  const folders: LocalFolder[] = [];
  const allFolderPaths = await walkFolders(localDir, localDir);

  for (const folderPath of allFolderPaths) {
    const relativePath = path.relative(localDir, folderPath).split(path.sep);

    folders.push({
      absolutePath: folderPath,
      pathRelativeToWorkspace: relativePath,
    });
  }

  return folders;
}
