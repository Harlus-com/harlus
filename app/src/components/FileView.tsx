import { PanelGroup, Panel } from "react-resizable-panels";
import { FileGroupCount } from "./panels";
import PanelDivider from "./PanelDivider";
import { WorkspaceFile } from "@/api/types";
import PdfViewer, { PdfViewerRef } from "@/components/ReactPdfViewer";
import { useRef } from "react";

export interface OpenFileGroup {
  files: WorkspaceFile[];
  selectedFile: WorkspaceFile | null;
}

export interface FileViewProps {
  openFiles: Record<FileGroupCount, OpenFileGroup | null>;
}

function FileGroupPanel({
  openFileGroup,
  id,
}: {
  openFileGroup: OpenFileGroup;
  id: string;
}) {
  const viewerRef = useRef<PdfViewerRef>(null);
  const { files, selectedFile } = openFileGroup;
  return (
    <Panel id={id} order={1}>
      <div className="bg-white p-4 border-b border-border">
        <h2 className="text-lg font-semibold text-foreground mb-2">
          File Tabs
        </h2>
      </div>
      <PanelGroup id={`${id}-files`} direction="horizontal">
        {selectedFile != null ? (
          <div className="flex-1 bg-white">
            <div className="h-full">
              <PdfViewer
                file={selectedFile}
                key={selectedFile.id}
                ref={viewerRef}
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 bg-white">Empty File Group</div>
        )}
      </PanelGroup>
    </Panel>
  );
}

export default function FileView({ openFiles }: FileViewProps) {
  console.log("openFiles", openFiles);
  const fileGroupCount = Object.values(openFiles).filter(
    (group) => group !== null
  ).length;

  return (
    <PanelGroup id="file-groups" direction="horizontal">
      <FileGroupPanel
        openFileGroup={openFiles[FileGroupCount.ONE]}
        id={`file-group-1`}
      />
      {fileGroupCount > FileGroupCount.ONE && (
        <>
          <PanelDivider />
          <FileGroupPanel
            openFileGroup={openFiles[FileGroupCount.TWO]}
            id={`file-group-2`}
          />
        </>
      )}
      {fileGroupCount > FileGroupCount.TWO && (
        <>
          <PanelDivider />
          <FileGroupPanel
            openFileGroup={openFiles[FileGroupCount.THREE]}
            id={`file-group-3`}
          />
        </>
      )}
      {fileGroupCount > FileGroupCount.THREE && (
        <>
          <PanelDivider />
          <FileGroupPanel
            openFileGroup={openFiles[FileGroupCount.FOUR]}
            id={`file-group-4`}
          />
        </>
      )}
    </PanelGroup>
  );
}
