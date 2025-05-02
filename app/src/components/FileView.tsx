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

export default function FileView({ openFiles }: FileViewProps) {
  console.log("openFiles", openFiles);
  const fileGroupCount = Object.values(openFiles).filter(
    (group) => group !== null
  ).length;
  const group1ViewerRef = useRef<PdfViewerRef>(null);
  const group2ViewerRef = useRef<PdfViewerRef>(null);
  const group3ViewerRef = useRef<PdfViewerRef>(null);
  const group4ViewerRef = useRef<PdfViewerRef>(null);

  return (
    <PanelGroup id="file-groups" direction="horizontal">
      <Panel id="file-group-1" order={1}>
        <div className="bg-white p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground mb-2">
            File Tabs
          </h2>
        </div>
        <PanelGroup id="file-group-1-files" direction="horizontal">
          {openFiles[FileGroupCount.ONE]?.selectedFile != null ? (
            <div className="flex-1 bg-white">
              <div className="h-full">
                <PdfViewer
                  file={openFiles[FileGroupCount.ONE].selectedFile}
                  key={openFiles[FileGroupCount.ONE].selectedFile!.id}
                  ref={group1ViewerRef}
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 bg-white">Empty File Group</div>
          )}
        </PanelGroup>
      </Panel>
      {fileGroupCount > FileGroupCount.ONE && (
        <>
          <PanelDivider />
          <Panel id="file-group-2" order={2}>
            <div className="bg-white p-4 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground mb-2">
                File Tabs
              </h2>
            </div>
            <PanelGroup id="file-group-2-files" direction="horizontal">
              Empty File Group
            </PanelGroup>
          </Panel>
        </>
      )}
      {fileGroupCount > FileGroupCount.TWO && (
        <>
          <PanelDivider />
          <Panel id="file-group-3" order={3}>
            <div className="bg-white p-4 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground mb-2">
                File Tabs
              </h2>
            </div>
            <PanelGroup id="file-group-3-files" direction="horizontal">
              Empty File Group
            </PanelGroup>
          </Panel>
        </>
      )}
      {fileGroupCount > FileGroupCount.THREE && (
        <>
          <PanelDivider />
          <Panel id="file-group-4" order={4}>
            <div className="bg-white p-4 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground mb-2">
                File Tabs
              </h2>
            </div>
            <PanelGroup id="file-group-4-files" direction="horizontal">
              Empty File Group
            </PanelGroup>
          </Panel>
        </>
      )}
    </PanelGroup>
  );
}
