import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import { WorkspaceFile } from "@/api/workspace_types";
import { fileService } from "@/api/fileService";
import { Worker, Viewer, SpecialZoomLevel } from "@react-pdf-viewer/core";
import { defaultLayoutPlugin } from "@react-pdf-viewer/default-layout";
import {
  highlightPlugin,
  Trigger,
  type HighlightArea,
  type RenderHighlightsProps,
} from "@react-pdf-viewer/highlight";
import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/default-layout/lib/styles/index.css";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.js?url";
import { useComments } from "@/comments/useComments";

interface PdfViewerProps {
  file: WorkspaceFile;
  initialPage?: number;
  /** Callback invoked when the user presses ENTER inside the inline input */
  onSendMessage?: (message: string) => void;
}

/**
 * Extend the library HighlightArea with the color coming from our comment object.
 */
type Highlight = HighlightArea & { color: string };

const PdfViewer = ({ file, onSendMessage, initialPage=0 }: PdfViewerProps) => {
  /* ------------------------------------------------------------------ */
  /*                               STATE                                */
  /* ------------------------------------------------------------------ */
  const { getActiveComments, getSelectedComment } = useComments();

  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [selectedText, setSelectedText] = useState<string>("");
  const [showInput, setShowInput] = useState<boolean>(false);
  const [inputValue, setInputValue] = useState<string>("");
  const [overlayPos, setOverlayPos] = useState<{ top: number; left: number } | null>(null);

  /* ------------------------------------------------------------------ */
  /*                               REFS                                 */
  /* ------------------------------------------------------------------ */
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /* ------------------------------------------------------------------ */
  /*                        COMMENT → HIGHLIGHTS                        */
  /* ------------------------------------------------------------------ */
  const activeComments = getActiveComments(file.id);
  const selectedComment = getSelectedComment(file.id);
  const highlightAreas: Highlight[] = useMemo(() => {
    return activeComments.flatMap((comment) =>
      comment.annotations.map((anno) => ({ ...anno, color: comment.highlightColor }))
    );
  }, [activeComments]);

  /* ------------------------------------------------------------------ */
  /*                         PDF VIEWER PLUGINS                         */
  /* ------------------------------------------------------------------ */
  const defaultLayoutPluginInstance = defaultLayoutPlugin({ sidebarTabs: () => [] });

  const renderHighlights = (props: RenderHighlightsProps) => (
    <>
      {highlightAreas
        .filter((a) => a.pageIndex === props.pageIndex)
        .map((area, i) => (
          <div
            key={i}
            className="highlight-area"
            style={{
              ...props.getCssProperties(area, props.rotation),
              background: area.color,
              opacity: 0.4,
            }}
          />
        ))}
    </>
  );

  const highlightPluginInstance = highlightPlugin({
    renderHighlights,
    trigger: Trigger.None,
  });

  /* When a comment is selected externally, scroll to its first annotation */
  useEffect(() => {
    if (selectedComment) {
      highlightPluginInstance.jumpToHighlightArea(selectedComment.annotations[0]);
    }
  }, [selectedComment, highlightPluginInstance]);

  /* ------------------------------------------------------------------ */
  /*                     LOAD + UNLOAD PDF FROM BLOB                    */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    let mounted = true;

    if (file) {
      fileService.getFileData(file).then((data) => {
        if (!mounted) return;
        const blob = new Blob([data], { type: "application/pdf" });
        setFileUrl(URL.createObjectURL(blob));
      });
    } else {
      setFileUrl(null);
    }

    return () => {
      mounted = false;
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    };
  }, [file]);

  /* ------------------------------------------------------------------ */
  /*                        TEXT‑SELECTION HANDLER                       */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    const handleMouseUp = () => {
      const selection = window.getSelection();
      const text = selection?.toString().trim() || "";
      setSelectedText(text);

      if (selection && text && selection.rangeCount > 0) {
        // Hide the input if it was visible for a previous selection
        setShowInput(false);

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        const containerRect = containerRef.current!.getBoundingClientRect();
        setOverlayPos({
          top: rect.bottom - containerRect.top + 4,
          left: rect.right - containerRect.left + 4,
        });
      } else {
        setOverlayPos(null);
      }
    };

    const node = containerRef.current;
    node?.addEventListener("mouseup", handleMouseUp);
    return () => node?.removeEventListener("mouseup", handleMouseUp);
  }, []);

  /* ------------------------------------------------------------------ */
  /*                           GLOBAL HOTKEYS                           */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === "k" && selectedText) {
        e.preventDefault();
        toggleInput(true);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedText]);

  /* ------------------------------------------------------------------ */
  /*                         HELPER  —  OPEN INPUT                       */
  /* ------------------------------------------------------------------ */
  const toggleInput = useCallback(
    (forceOpen?: boolean) => {
      setShowInput((prev) => {
        const next = forceOpen ?? !prev;
        if (next) {
          // Focus after the DOM has painted the input element
          setTimeout(() => inputRef.current?.focus(), 0);
        }
        return next;
      });
    },
    []
  );

  /* ------------------------------------------------------------------ */
  /*                        SEND CHAT FROM INPUT                         */
  /* ------------------------------------------------------------------ */
  const sendChatMessage = () => {
    const formattedMessage = `${selectedText}\n${inputValue}`.trim();
    if (!formattedMessage) return;

    onSendMessage?.(formattedMessage);
    setInputValue("");
    setShowInput(false);
  };

  /* ------------------------------------------------------------------ */
  /*                                JSX                                 */
  /* ------------------------------------------------------------------ */
  if (!file) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <p className="text-lg">No document selected</p>
          <p className="text-sm">Select a PDF from the sidebar or drag and drop a file here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full" ref={containerRef}>
      {/* PDF */}
      <Worker workerUrl={pdfjsWorker}>
        {fileUrl ? (
          <Viewer
            fileUrl={fileUrl}
            defaultScale={SpecialZoomLevel.PageWidth}
            plugins={[defaultLayoutPluginInstance, highlightPluginInstance]}
            initialPage={initialPage ? initialPage : 0}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p>Loading PDF…</p>
          </div>
        )}
      </Worker>

      {/* Overlay bubble or input */}
      {selectedText && overlayPos && (
        <div
          className="absolute rounded p-2 flex items-center" 
          style={{ zIndex: 999, top: overlayPos.top, left: overlayPos.left }}
        >
          {!showInput ? (
            <button
              type="button"
              onClick={() => toggleInput(true)}
              className="flex items-center gap-1 text-sm bg-blue-50 border border-blue-700 text-blue-700 px-3 py-1.5 rounded-md shadow hover:bg-blue-100 focus:outline-none"
            >
              Ask Harlus (Ctrl+K)
            </button>
          ) : (
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Type your question…"
              className="text-sm bg-blue-50 border border-blue-700 text-blue-700 px-3 py-1.5 rounded-md w-56 focus:outline-none focus:ring-2 focus:ring-blue-400 shadow"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  sendChatMessage();
                }
              }}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default PdfViewer;
