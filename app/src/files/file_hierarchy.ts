import { WorkspaceFile, WorkspaceFolder } from "@/api/workspace_types";

export interface FolderNode {
  name: string;
  path: string[];
  children: Map<string, FolderNode>;
  files: WorkspaceFile[];
}

function extend(nodeToExtend: FolderNode, segments: string[]) {
  if (segments.length === 0) {
    return;
  }
  const newNode = {
    name: segments[0],
    path: [segments[0]],
    children: new Map(),
    files: [],
  };
  if (!nodeToExtend.children.has(newNode.name)) {
    nodeToExtend.children.set(newNode.name, newNode);
  }
  extend(nodeToExtend.children.get(newNode.name)!, segments.slice(1));
}

function traverse(node: FolderNode, segments: string[]): FolderNode {
  if (segments.length === 0) {
    return node;
  }
  const child = node.children.get(segments[0]);
  if (!child) {
    throw new Error(`Folder node not found: ${segments[0]}`);
  }
  return traverse(child, segments.slice(1));
}

export function buildFolderTree(
  files: WorkspaceFile[],
  folders: WorkspaceFolder[]
): FolderNode {
  const root: FolderNode = {
    name: "",
    path: [],
    children: new Map(),
    files: [],
  };

  folders.forEach((folder) => {
    extend(root, folder.appDir);
  });

  files.forEach((file) => {
    if (file.appDir.length === 0) {
      root.files.push(file);
      return;
    }
    extend(root, file.appDir);
    const folderNode = traverse(root, file.appDir);
    folderNode.files.push(file);
  });

  return root;
}
