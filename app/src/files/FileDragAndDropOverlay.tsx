import { fileService } from "@/api/fileService";
import { useRef } from "react";

import { useState } from "react";
import { useFileContext } from "./FileContext";
import { client } from "@/api/client";

interface FileDragAndDropOverlayProps {
  workspaceId: string;
  children: React.ReactNode;
}

export const FileDragAndDropOverlay = ({
  workspaceId,
  children,
}: FileDragAndDropOverlayProps) => {
  const { notifyFileListChanged } = useFileContext();
  const dropAreaRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files: any[] = Array.from(e.dataTransfer.files);
    for (const file of files) {
      console.log("uploading file", file.path, workspaceId);
      await client.upload(file.path, workspaceId);
      notifyFileListChanged();
    }
  };
  return (
    <div
      className="flex-1 flex overflow-hidden"
      ref={dropAreaRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-card p-8 rounded-lg shadow-lg text-center">
            <div className="text-4xl mb-4">📄</div>
            <div className="text-xl font-medium">Drop PDFs here</div>
            <div className="text-muted-foreground mt-2">
              Files will be added to your workspace
            </div>
          </div>
        </div>
      )}
      {children}
    </div>
  );
};
