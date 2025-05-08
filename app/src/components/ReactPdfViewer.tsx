import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { WorkspaceFile } from "@/api/workspace_types";
import { fileService } from "@/api/fileService";
import { Worker, Viewer } from "@react-pdf-viewer/core";
import { defaultLayoutPlugin } from "@react-pdf-viewer/default-layout";
import { highlightPlugin, Trigger } from "@react-pdf-viewer/highlight";
import type { HighlightArea, RenderHighlightsProps } from "@react-pdf-viewer/highlight";
import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/default-layout/lib/styles/index.css";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.js?url";
import { useComments } from "@/comments/useComments";

// Add prop or use context to get the handler
interface PdfViewerProps {
  file: WorkspaceFile;
  onSendMessage?: (message: string) => void;  // Add this prop
}

type Highlight = HighlightArea & { color: string };

const PdfViewer = ({ file, onSendMessage }: PdfViewerProps) => {
  const { getActiveComments, getSelectedComment } = useComments();
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [selectedText, setSelectedText] = useState<string>("");
  const [showInput, setShowInput] = useState<boolean>(false);
  const [inputValue, setInputValue] = useState<string>("");
  const [overlayPos, setOverlayPos] = useState<{ top: number; left: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ← NEW: ref to the <input> so we can .focus()
  const inputRef = useRef<HTMLInputElement>(null);

  // comments/highlights (unchanged)…
  const activeComments = getActiveComments(file.id);
  const selectedComment = getSelectedComment(file.id);
  const highlightAreas: Highlight[] = useMemo(
    () =>
      activeComments.flatMap((comment) =>
        comment.annotations.map((anno) => ({ ...anno, color: comment.highlightColor }))
      ),
    [activeComments]
  );

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

  const defaultLayoutPluginInstance = defaultLayoutPlugin();
  const highlightPluginInstance = highlightPlugin({
    renderHighlights,
    trigger: Trigger.None,
  });

  useEffect(() => {
    if (selectedComment) {
      highlightPluginInstance.jumpToHighlightArea(selectedComment.annotations[0]);
    }
  }, [selectedComment, highlightPluginInstance]);

  // load PDF (unchanged)…
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

  // selection handler (unchanged) …
  useEffect(() => {
    const handler = () => {
      const selection = window.getSelection();
      const text = selection?.toString().trim() || "";
      setSelectedText(text);

      if (selection && text && selection.rangeCount > 0) {
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
    node?.addEventListener("mouseup", handler);
    return () => node?.removeEventListener("mouseup", handler);
  }, []);

  // Ctrl+K toggles input (unchanged)…
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === "k" && selectedText) {
        e.preventDefault();
        setShowInput((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedText]);

  // ← NEW: whenever showInput flips on, focus the field
  useEffect(() => {
    if (showInput) {
      inputRef.current?.focus();
    }
  }, [showInput]);

  // Add a ref to access the chat panel's setInput and handleSendMessage
  const sendToChatPanel = useCallback((message: string) => {
    // Find the textarea element in the ChatPanel
    const chatInput = document.querySelector('.ChatPanel textarea') as HTMLTextAreaElement;
    if (chatInput) {
      // Set the value
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(chatInput, message);
        
        // Trigger input event
        const inputEvent = new Event('input', { bubbles: true });
        chatInput.dispatchEvent(inputEvent);
        
        // Trigger Enter keypress
        const enterEvent = new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          bubbles: true
        });
        chatInput.dispatchEvent(enterEvent);
      }
    }
  }, []);

  const sendChatMessage = () => {
    // Format the message with highlighted text and question
    const formattedMessage = `${selectedText}\n\n${inputValue}`;
    
    // Simply call the passed handler
    onSendMessage(formattedMessage);
    
    // Clear and close the overlay
    setInputValue("");
    setShowInput(false);
  };

  if (!file) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <p className="text-lg">No document selected</p>
          <p className="text-sm">
            Select a PDF from the sidebar or drag and drop a file here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full" ref={containerRef}>
      <Worker workerUrl={pdfjsWorker}>
        {fileUrl ? (
          <Viewer
            fileUrl={fileUrl}
            plugins={[defaultLayoutPluginInstance, highlightPluginInstance]}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p>Loading PDF…</p>
          </div>
        )}
      </Worker>

      {selectedText && overlayPos && (
        <div
          className="absolute bg-white shadow rounded p-2 flex items-center space-x-2"
          style={{
            zIndex: 999,
            top: overlayPos.top,
            left: overlayPos.left,
          }}
        >
          {!showInput ? (
            <span className="text-sm text-gray-700">Ask Harlus (Ctrl+K)</span>
          ) : (
            <input
              ref={inputRef}                                    // ← hook up ref
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Type your question…"
              className="border rounded px-2 py-1 text-sm w-48"
              // ← NEW: handle Enter
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  sendChatMessage();
                }
              }}
              // ← REMOVE onBlur (so it doesn’t disappear when you click in it)
            />
          )}
        </div>
      )}
    </div>
  );
};

export default PdfViewer;
