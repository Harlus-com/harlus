import { promises as fs } from "fs";
import * as fsCallback from "fs"; // For fs.createWriteStream
import path from "path";
import crypto from "crypto";
import axios, { AxiosError } from "axios"; // Import axios
import stream from "stream"; // Import stream for pipeline
import { promisify } from "util"; // Import promisify
import { LocalFile, LocalFolder } from "./electron_types";
import chokidar, { FSWatcher } from "chokidar";
import { Agent } from "https"; // Import Agent for httpsAgent type

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
  item: LocalFile | LocalFolder,
  newRelativePath: string[]
) {
  const newPathParts: string[] = getWorkspaceAbsolutePath(item);
  for (const part of newRelativePath) {
    newPathParts.push(part);
  }
  if ((item as LocalFile).name) {
    newPathParts.push((item as LocalFile).name);
  } else {
    const folderRelativepath = [...item.pathRelativeToWorkspace];
    newPathParts.push(folderRelativepath.pop()!);
  }
  const newPath = newPathParts.join(path.sep);
  console.log("moveItem", item.absolutePath, newPath);
  await fs.rename(item.absolutePath, newPath);
}

function getWorkspaceAbsolutePath(item: LocalFile | LocalFolder) {
  const currentPathParts = item.absolutePath.split(path.sep);
  const relativePath = maybeAddNameToRelativePath(item);
  if (!isSubPath(currentPathParts, relativePath)) {
    throw new Error(
      `Invalid path: ${relativePath} is not a subpath of ${item.absolutePath}`
    );
  }
  return currentPathParts.slice(0, -1 * relativePath.length);
}

function maybeAddNameToRelativePath(item: LocalFile | LocalFolder) {
  if ((item as LocalFile).name) {
    return [
      ...(item as LocalFile).pathRelativeToWorkspace,
      (item as LocalFile).name,
    ];
  }
  return (item as LocalFolder).pathRelativeToWorkspace;
}

function isSubPath(pathParts: string[], relativePath: string[]) {
  return pathParts.join(path.sep).endsWith(relativePath.join(path.sep));
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

// export async function createWriteStream(
//   filePath: string
// ): Promise<{
//   write(chunk: Uint8Array): Promise<void>;
//   close(): Promise<void>;
// }> {
//   const stream = fsCallback.createWriteStream(filePath);
//   return {
//     write(chunk: Uint8Array): Promise<void> {
//       return new Promise<void>((resolve, reject) => {
//         const ok = stream.write(chunk, (err) => {
//           if (err) reject(err);
//           else resolve();
//         });
//         if (!ok) {
//           stream.once("drain", () => resolve());
//         }
//       });
//     },
//     close(): Promise<void> {
//       return new Promise<void>((resolve, reject) => {
//         stream.end(() => resolve());
//         stream.once("error", (err) => reject(err));
//       });
//     },
//   };
// }

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

    const localFileWriteStream = fsCallback.createWriteStream(localFilePath); // Use fsCallback
    await pipeline(response.data, localFileWriteStream);
    console.log(`[Local File System] Successfully downloaded and saved ${localFilePath}`); // Log updated
    return true;
  } catch (error: unknown) { // Catch as unknown
    let errorMessage = `Error downloading from ${downloadUrl} to ${localFilePath}`;
    if (error instanceof Error) {
      errorMessage += `: ${error.message}`;
    }
    // For Axios specific errors, you might want to extract more info
    if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        if (axiosError.response) {
            errorMessage += ` - Status: ${axiosError.response.status}, Data: ${JSON.stringify(axiosError.response.data)}`;
        } else if (axiosError.request) {
            errorMessage += ` - No response received`;
        }
    }
    console.error(`[Local File System] ${errorMessage}`, error); // Log the original error too for server-side debugging

    try {
      await fs.unlink(localFilePath);
    } catch (cleanupError) {
      console.error(`[Local File System] Error cleaning up ${localFilePath}:`, cleanupError);
    }
    // Throw a new, simple error that is serializable
    throw new Error(errorMessage);
  }
}


