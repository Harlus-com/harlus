import React, {
  useState,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useMemo,
} from "react";
import { WorkspaceFile } from "@/api/types";
import { fileService } from "@/api/fileService";

// react-pdf-viewer imports
import { Worker, Viewer } from "@react-pdf-viewer/core";
import { defaultLayoutPlugin } from "@react-pdf-viewer/default-layout";
import { highlightPlugin, Trigger } from "@react-pdf-viewer/highlight";
// styles for core and default layout
import type {
  HighlightArea,
  RenderHighlightsProps,
} from "@react-pdf-viewer/highlight";
import "@react-pdf-viewer/core/lib/styles/index.css";
import { pageNavigationPlugin } from "@react-pdf-viewer/page-navigation";
import "@react-pdf-viewer/default-layout/lib/styles/index.css";

// pdfjs worker for the Viewer
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.js?url";
import { useComments } from "@/comments/useComments";

interface PdfViewerProps {
  file: WorkspaceFile;
}

type Highlight = HighlightArea & { color: string };

// Define the ref interface
export interface PdfViewerRef {
  jumpToPage: (zeroBasedPageIndex: number) => void;
}

const PdfViewer = forwardRef<PdfViewerRef, PdfViewerProps>(({ file }, ref) => {
  const { getActiveComments, getSelectedComment } = useComments();
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const activeComments = getActiveComments(file.id);
  const selectedComment = getSelectedComment(file.id);
  const initialPage = selectedComment?.jumpToPageNumber;

  const highlightAreas: Highlight[] = useMemo(() => {
    const areas: Highlight[] = [];
    for (const comment of activeComments) {
      for (const annotation of comment.annotations) {
        areas.push({
          ...annotation,
          color: comment.highlightColor,
        });
      }
    }
    return areas;
  }, [activeComments]);

  useImperativeHandle(ref, () => ({
    jumpToPage: (zeroBasedPageIndex: number) => {
      pageNavigationPluginInstance.jumpToPage(zeroBasedPageIndex);
    },
  }));

  // initialize the default-layout plugin
  const defaultLayoutPluginInstance = defaultLayoutPlugin();

  const renderHighlights = (props: RenderHighlightsProps) => (
    <div>
      {highlightAreas
        .filter((area) => area.pageIndex === props.pageIndex)
        .map((area, idx) => (
          <div
            key={idx}
            className="highlight-area"
            style={Object.assign(
              {},
              {
                background: area.color,
                opacity: 0.4,
              },
              props.getCssProperties(area, props.rotation)
            )}
          />
        ))}
    </div>
  );

  const highlightPluginInstance = highlightPlugin({
    renderHighlights,
    trigger: Trigger.None,
  });

  const pageNavigationPluginInstance = pageNavigationPlugin();

  useEffect(() => {
    let isMounted = true;

    if (file) {
      fileService
        .getFileData(file)
        .then((data) => {
          if (!isMounted) return;
          const blob = new Blob([data], { type: "application/pdf" });
          const url = URL.createObjectURL(blob);
          setFileUrl(url);
          if (initialPage) {
            pageNavigationPluginInstance.jumpToPage(initialPage);
          }
        })
        .catch((err) => {
          console.error("Failed to load PDF data", err);
          setFileUrl(null);
        });
    } else {
      setFileUrl(null);
    }

    return () => {
      isMounted = false;
      if (fileUrl) {
        URL.revokeObjectURL(fileUrl);
      }
    };
  }, [file]);

  if (!file) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-muted-foreground">No document selected</p>
          <p className="text-sm text-muted-foreground">
            Select a PDF from the sidebar or drag and drop a file here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full">
      <Worker workerUrl={pdfjsWorker}>
        {fileUrl ? (
          <Viewer
            fileUrl={fileUrl}
            plugins={[
              defaultLayoutPluginInstance,
              highlightPluginInstance,
              pageNavigationPluginInstance,
            ]}
            defaultScale={1}
            onPageChange={(e) => {
              // This is just for tracking the current page
              // The actual page change is handled by initialPage prop
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p>Loading PDF…</p>
          </div>
        )}
      </Worker>
    </div>
  );
});

export default PdfViewer;
