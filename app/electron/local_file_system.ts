import { promises as fs } from "fs";
import * as fsCallback from "fs";
import path from "path";
import crypto from "crypto";
import axios, { AxiosError } from "axios";
import stream from "stream";
import { promisify } from "util";
import { LocalFile, LocalFolder } from "./electron_types";
import chokidar, { FSWatcher } from "chokidar";
import { Agent } from "https";

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
    const fileName = path.basename(filePath);
    if (fileName.startsWith(".")) {
      continue;
    }
    files.push(await createLocalFile(filePath, localDir));
  }

  return files;
}

export async function getLocalFolders(
  localDir: string
): Promise<LocalFolder[]> {
  const folders: LocalFolder[] = [];
  const allFolderPaths = await walkFolders(localDir, localDir);

  for (const folderPath of allFolderPaths) {
    const folderName = path.basename(folderPath);
    if (folderName.startsWith(".")) {
      continue;
    }
    const relativePath = path.relative(localDir, folderPath).split(path.sep);
    folders.push({
      absolutePath: folderPath,
      pathRelativeToWorkspace: relativePath,
    });
  }

  return folders;
}

export class WorkspaceWatcher {
  private watcher: FSWatcher | null = null;

  constructor(
    private readonly send: (event: any) => void,
    private readonly workspacePath: string
  ) {
    this.workspacePath = workspacePath;
  }

  async start(): Promise<void> {
    if (this.watcher) {
      return;
    }

    // See https://github.com/paulmillr/chokidar
    this.watcher = chokidar.watch(this.workspacePath, {
      /**
       * Indicates whether the process should continue to run as long as files are being watched.
       */
      persistent: true,
      /**
       *  If set to false then add/addDir events are also emitted for matching paths while instantiating the watching as chokidar discovers these file paths (before the ready event).
       */
      ignoreInitial: true,
      followSymlinks: false,
      /**
       * By default, the add event will fire when a file first appears on disk, before the entire file has been written.
       * Furthermore, in some cases some change events will be emitted while the file is being written.
       * In some cases, especially when watching for large files there will be a need to wait for the write operation to finish before responding to a file creation or modification.
       * Setting awaitWriteFinish to true (or a truthy value) will poll file size, holding its add and change events until the size does not change for a configurable amount of time.
       * The appropriate duration setting is heavily dependent on the OS and hardware.
       */
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100, // Note: This does not mean that the watcher is polling, except for when a new big file is being written.
      },
      /**
       * Automatically filters out artifacts that occur when using editors that use "atomic writes" instead of writing directly to the source file.
       * If a file is re-added within 100 ms of being deleted, Chokidar emits a change event rather than unlink then add.
       * If the default of 100 ms does not work well for you, you can override it by setting atomic to a custom value, in milliseconds.
       */
      atomic: true,
    });

    this.watcher.on("change", async (filePath: string) => {
      console.log("change", filePath);
      const fileName = path.basename(filePath);
      if (fileName.startsWith(".")) {
        return;
      }

      const localFile = await createLocalFile(filePath, this.workspacePath);
      this.send({
        file: localFile,
        type: "workspace-file-change",
      });
    });

    this.watcher.on("add", (filePath: string) => {
      console.log("add", filePath);
      this.send({
        type: "workspace-structure-change",
      });
    });

    this.watcher.on("unlink", (filePath: string) => {
      console.log("unlink", filePath);
      this.send({
        type: "workspace-structure-change",
      });
    });

    this.watcher.on("addDir", (filePath: string) => {
      console.log("addDir", filePath);
      this.send({
        type: "workspace-structure-change",
      });
    });

    this.watcher.on("unlinkDir", (filePath: string) => {
      console.log("unlinkDir", filePath);
      this.send({
        type: "workspace-structure-change",
      });
    });

    this.watcher.on("ready", () => {
      console.log("Workspace watcher is ready");
    });

    this.watcher.on("error", (error: unknown) => {
      console.error("Workspace watcher error:", error);
    });
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }
}

async function createLocalFile(
  filePath: string,
  localDir: string
): Promise<LocalFile> {
  const content = await fs.readFile(filePath);
  const contentHash = crypto.createHash("sha256").update(content).digest("hex");
  const relativePath = path.relative(localDir, filePath).split(path.sep);
  relativePath.pop();
  return {
    contentHash,
    absolutePath: filePath,
    pathRelativeToWorkspace: relativePath,
    name: path.basename(filePath),
  };
}

export async function moveItem(
  oldAbsolutePath: string,
  newAbsolutePathParts: string[]
) {
  const { root } = path.parse(oldAbsolutePath);
  const newAbsolutePath = path.join(
    root,
    ...newAbsolutePathParts.filter(Boolean) // filter "" on POSIX systems
  );
  console.log("move", oldAbsolutePath, newAbsolutePath);
  await fs.rename(oldAbsolutePath, newAbsolutePath);
}

export async function createFolder(
  parentFolder: LocalFolder,
  newFolderName: string
) {
  await fs.mkdir(path.join(parentFolder.absolutePath, newFolderName));
}

export async function createFile(
  workspaceLocalPath: string,
  relativeDestPath: string,
  fileName: string,
  data: Buffer
) {
  const destinationDirectory = path.join(workspaceLocalPath, relativeDestPath);
  await fs.mkdir(destinationDirectory, { recursive: true });
  const filePath = path.join(destinationDirectory, fileName);
  await fs.writeFile(filePath, data);
  console.log(`[LocalFileSystem] File created: ${filePath}`);
}

export async function deleteItem(item: LocalFile | LocalFolder) {
  if (!(item as LocalFile).name) {
    await fs.rm(item.absolutePath, { recursive: true, force: true });
  } else {
    await fs.rm(item.absolutePath);
  }
}

export async function ensureFile(
  localDir: string,
  pathRelativeToWorkspace: string,
  fileName: string
): Promise<string> {
  const dirPath = path.resolve(localDir, pathRelativeToWorkspace);
  await fs.mkdir(dirPath, { recursive: true });
  return path.join(dirPath, fileName);
}

const pipeline = promisify(stream.pipeline);

export async function downloadPdfFromUrl(
  downloadUrl: string, 
  localFilePath: string, 
  httpsAgent: Agent | undefined,
  authHeader?: string
): Promise<boolean> {
  try {
    console.log(`[Local File System] Downloading from ${downloadUrl} to ${localFilePath}`);
    const headers: Record<string, string> = {};
    if (authHeader) {
      headers["Authorization"] = authHeader;
    }

    const response = await axios.get(downloadUrl, {
      responseType: "stream",
      httpsAgent,
      headers,
    });

    const localFileWriteStream = fsCallback.createWriteStream(localFilePath);
    await pipeline(response.data, localFileWriteStream);
    console.log(`[Local File System] Successfully downloaded and saved ${localFilePath}`);
    return true;
  } catch (error: unknown) {
    console.error(`[Local File System] Error downloading from ${downloadUrl}`, error);
    try {
      await fs.unlink(localFilePath);
    } catch (cleanupError) { /* ignore or log simply */ }
    throw new Error(`Error downloading from ${downloadUrl}`);
  }
}
