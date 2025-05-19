import { WorkspaceFile, WorkspaceFolder } from "./workspace_types";

export const mockFiles: WorkspaceFile[] = [
  {
    id: "1",
    name: "document1.pdf",
    absolutePath: "/path/to/document1.pdf",
    workspaceId: "workspace1",
    appDir: ["documents", "legal"],
  },
  {
    id: "2",
    name: "document2.pdf",
    absolutePath: "/path/to/document2.pdf",
    workspaceId: "workspace1",
    appDir: ["documents", "legal"],
  },
  {
    id: "3",
    name: "report.pdf",
    absolutePath: "/path/to/report.pdf",
    workspaceId: "workspace1",
    appDir: ["documents", "reports"],
  },
  {
    id: "4",
    name: "contract.pdf",
    absolutePath: "/path/to/contract.pdf",
    workspaceId: "workspace1",
    appDir: ["documents", "contracts"],
  },
  {
    id: "5",
    name: "meeting_notes.pdf",
    absolutePath: "/path/to/meeting_notes.pdf",
    workspaceId: "workspace1",
    appDir: ["documents", "meetings", "2024"],
  },
  {
    id: "6",
    name: "presentation.pdf",
    absolutePath: "/path/to/presentation.pdf",
    workspaceId: "workspace1",
    appDir: ["documents", "presentations"],
  },
  {
    id: "7",
    name: "root_file.pdf",
    absolutePath: "/path/to/root_file.pdf",
    workspaceId: "workspace1",
    appDir: [],
  },
  {
    id: "8",
    name: "foo_doc.pdf",
    absolutePath: "/path/to/foo_doc.pdf",
    workspaceId: "workspace1",
    appDir: ["documents", "foo"],
  },
  {
    id: "9",
    name: "bar_doc.pdf",
    absolutePath: "/path/to/bar_doc.pdf",
    workspaceId: "workspace1",
    appDir: ["documents", "bar"],
  },
  {
    id: "10",
    name: "nested_foo.pdf",
    absolutePath: "/path/to/nested_foo.pdf",
    workspaceId: "workspace1",
    appDir: ["documents", "foo", "nested"],
  },
  {
    id: "11",
    name: "nested_bar.pdf",
    absolutePath: "/path/to/nested_bar.pdf",
    workspaceId: "workspace1",
    appDir: ["documents", "bar", "nested"],
  },
  {
    id: "12",
    name: "deep_nested.pdf",
    absolutePath: "/path/to/deep_nested.pdf",
    workspaceId: "workspace1",
    appDir: ["documents", "foo", "nested", "deep"],
  },
];

export const mockFolders: WorkspaceFolder[] = [
  {
    id: "1",
    workspaceId: "workspace1",
    appDir: ["documents"],
  },
  {
    id: "2",
    workspaceId: "workspace1",
    appDir: ["documents", "legal"],
  },
  {
    id: "3",
    workspaceId: "workspace1",
    appDir: ["documents", "reports"],
  },
  {
    id: "4",
    workspaceId: "workspace1",
    appDir: ["documents", "contracts"],
  },
  {
    id: "5",
    workspaceId: "workspace1",
    appDir: ["documents", "meetings"],
  },
  {
    id: "6",
    workspaceId: "workspace1",
    appDir: ["documents", "meetings", "2024"],
  },
  {
    id: "7",
    workspaceId: "workspace1",
    appDir: ["documents", "presentations"],
  },
  {
    id: "8",
    workspaceId: "workspace1",
    appDir: ["documents", "foo"],
  },
  {
    id: "9",
    workspaceId: "workspace1",
    appDir: ["documents", "bar"],
  },
  {
    id: "10",
    workspaceId: "workspace1",
    appDir: ["documents", "foo", "nested"],
  },
  {
    id: "11",
    workspaceId: "workspace1",
    appDir: ["documents", "bar", "nested"],
  },
  {
    id: "12",
    workspaceId: "workspace1",
    appDir: ["documents", "foo", "nested", "deep"],
  },
];
