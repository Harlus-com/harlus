import { OpenFileGroup } from "@/components/OpenFileGroup";
import { FileGroupCount } from "@/components/panels";
import { useContext, useRef, useState } from "react";
import React, { createContext } from "react";
import {
  fileGroupCounts,
  getFileGroupsToOpen,
  getTargetFileGroup,
} from "./file_util";
import { WorkspaceFile } from "@/api/workspace_types";
import { FilesToOpen } from "./file_types";
import { OpenFilesOptions } from "./file_types";
import { ImperativePanelGroupHandle } from "react-resizable-panels";
import { useFileContext } from "./FileContext";

interface FileViewContextType {
  getOpenFiles: () => Record<FileGroupCount, OpenFileGroup | null>;
  setFileGroupCount: (count: FileGroupCount) => void;
  openFile: (
    file: WorkspaceFile,
    options: { showComments: boolean; fileGroup: FileGroupCount }
  ) => void;
  openFiles: (filesToOpen: FilesToOpen, options?: OpenFilesOptions) => void;
  getFileGroupOneRef: () => React.RefObject<ImperativePanelGroupHandle>;
  closeFile: (groupIndex: FileGroupCount, fileId: string) => void;
  toggleComments: (groupIndex: FileGroupCount, fileId: string) => void;
}

const FileViewContext = createContext<FileViewContextType | null>(null);

export const useFileViewContext = () => {
  const context = useContext(FileViewContext);
  if (!context) {
    throw new Error("useFileViewContext must be used within a FileViewContext");
  }
  return context;
};

interface FileViewContextProviderProps {
  children: React.ReactNode;
}

export const FileViewContextProvider: React.FC<
  FileViewContextProviderProps
> = ({ children }) => {
  const fileGroupOneRef = useRef<ImperativePanelGroupHandle>(null);
  const { getFile } = useFileContext();
  const [openedFiles, setOpenedFiles] = useState<
    Record<FileGroupCount, OpenFileGroup | null>
  >({
    [FileGroupCount.ONE]: OpenFileGroup.empty(),
    [FileGroupCount.TWO]: null,
  });
  const setFileGroupCount = (count: FileGroupCount) => {
    const updates: Record<FileGroupCount, OpenFileGroup | null> = {
      [FileGroupCount.ONE]: null,
      [FileGroupCount.TWO]: null,
    };
    for (const group of fileGroupCounts()) {
      if (group > count) {
        updates[group] = null;
      } else {
        if (openedFiles[group] == null) {
          updates[group] = OpenFileGroup.empty();
        } else {
          updates[group] = openedFiles[group];
        }
      }
    }
    setOpenedFiles(() => updates);
  };

  const openFile = (
    file: WorkspaceFile,
    options: { showComments: boolean; fileGroup: FileGroupCount }
  ) => {
    const groupNumber = options.fileGroup;
    const current = openedFiles[groupNumber];
    const updates = {};
    if (current == null) {
      updates[groupNumber] = OpenFileGroup.empty().addFile(file, {
        select: true,
        showComments: options.showComments,
      });
    } else {
      updates[groupNumber] = current.addFile(file, {
        select: true,
        showComments: options.showComments,
      });
    }
    setOpenedFiles((prev) => ({
      ...prev,
      ...updates,
    }));
  };

  const openFiles = (filesToOpen: FilesToOpen, options?: OpenFilesOptions) => {
    if (options?.resizeFileGroupOneCommentPanel) {
      const currentLayout = fileGroupOneRef.current?.getLayout();
      if (currentLayout && currentLayout.length == 2) {
        fileGroupOneRef.current?.setLayout([65, 35]);
      }
    }
    setOpenedFiles((prev) => {
      const openFilesIntoGroups = getFileGroupsToOpen(filesToOpen);
      const newOpenFiles = { ...prev };
      if (options?.closeAllOtherFiles) {
        for (const groupCount of fileGroupCounts()) {
          newOpenFiles[groupCount] = OpenFileGroup.empty();
        }
      }
      if (options?.closeAllOtherFileGroups) {
        for (const groupCount of fileGroupCounts()) {
          if (!openFilesIntoGroups.includes(groupCount)) {
            newOpenFiles[groupCount] = null;
          }
        }
      }
      for (const [fileId, options] of Object.entries(filesToOpen)) {
        const targetFileGroup = getTargetFileGroup(
          fileId,
          options.fileGroup,
          newOpenFiles
        );
        const currentGroup =
          newOpenFiles[targetFileGroup] || OpenFileGroup.empty();
        const file = getFile(fileId);
        if (!file) {
          console.error(`File ${fileId} not found`);
          continue;
        }
        newOpenFiles[targetFileGroup] = currentGroup.addFile(file, {
          select: options.select,
          showComments: options.showComments,
        });
      }
      return newOpenFiles;
    });
  };

  const getOpenFiles = () => {
    return openedFiles;
  };

  const getFileGroupOneRef = () => {
    return fileGroupOneRef;
  };
  const closeFile = (groupIndex: FileGroupCount, fileId: string) => {
    const group = openedFiles[groupIndex] || OpenFileGroup.empty();
    setOpenedFiles((prev) => {
      return {
        ...prev,
        [groupIndex]: group.removeFile(fileId),
      };
    });
  };

  const toggleComments = (groupIndex: FileGroupCount, fileId: string) => {
    const group = openedFiles[groupIndex] || OpenFileGroup.empty();
    setOpenedFiles((prev) => {
      return { ...prev, [groupIndex]: group.toggleShowComments(fileId) };
    });
  };

  const value = {
    getOpenFiles,
    setFileGroupCount,
    openFile,
    openFiles,
    getFileGroupOneRef,
    closeFile,
    toggleComments,
  };

  return (
    <FileViewContext.Provider value={value}>
      {children}
    </FileViewContext.Provider>
  );
};
