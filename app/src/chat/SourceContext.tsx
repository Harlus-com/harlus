import { WorkspaceFile } from "@/api/workspace_types";
import React from "react";

export const SourceClickContext = React.createContext<{
  onSourceClicked?: (file: WorkspaceFile) => void;
}>({});
