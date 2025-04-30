import React, { useState, useEffect, useRef } from "react";
import { WorkspaceFile } from "@/api/types";
import { Button } from "@/components/ui/button";
import * as pdfjsLib from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { Input } from "@/components/ui/input";
import { ZoomOut } from "lucide-react";
import { ZoomIn } from "lucide-react";
import { fileService } from "@/api/fileService";

// Initialize pdfjs worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface PdfViewerProps {
  file: WorkspaceFile | null;
}

const PdfViewer: React.FC<PdfViewerProps> = ({ file }) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [renderedPages, setRenderedPages] = useState<JSX.Element[]>([]);
  const [pageInput, setPageInput] = useState<string>("");
  const [scale, setScale] = useState<number>(1);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Reset state when file changes
    if (file) {
      setNumPages(null);
      setIsLoading(true);
      setRenderedPages([]);
      setPageInput("");
      loadPDF();
    } else {
      pdfDocRef.current = null;
    }
  }, [file]);

  // Add effect to re-render PDF when scale changes
  useEffect(() => {
    if (pdfDocRef.current) {
      renderAllPages(pdfDocRef.current);
    }
  }, [scale]);

  const loadPDF = async () => {
    if (!file) return;

    try {
      setIsLoading(true);

      // Get file content using Electron API
      //const pdfData = await window.electron?.getFileContent(file.path);
      //const pdfData = await window.electron?.getFileContent(
      //  "/Users/danielglasgow/src/harlus/workspace/wood/.rawdata/public/sec/AAPL/20250131_Q1_2025_AAPL_10-Q.pdf"
      //);
      console.log("file", file);
      const pdfData = await fileService.getFileData(file);
      if (!pdfData) {
        throw new Error("Failed to read PDF file");
      }

      // Load the PDF document
      const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
      pdfDocRef.current = pdf;
      setNumPages(pdf.numPages);

      // Render all pages
      await renderAllPages(pdf);
      setIsLoading(false);
    } catch (err) {
      console.error("Error loading PDF:", err);
      setIsLoading(false);
    }
  };

  const renderAllPages = async (pdf: pdfjsLib.PDFDocumentProxy) => {
    const pages: JSX.Element[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: scale + 0.5 });

      // Create a canvas for each page
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const context = canvas.getContext("2d");
      if (!context) continue;

      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;

      // Add the rendered page to the array
      pages.push(
        <div
          key={`page-${pageNum}`}
          id={`page-${pageNum}`}
          className="mb-4 flex flex-col items-center"
        >
          <canvas
            ref={(el) => {
              if (el) {
                el.width = viewport.width;
                el.height = viewport.height;
                const ctx = el.getContext("2d");
                if (ctx) {
                  ctx.drawImage(canvas, 0, 0);
                }
              }
            }}
            style={{
              maxWidth: "100%",
              height: "auto",
              boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
            }}
          />
          <div className="mt-4 text-sm text-gray-500">
            Page {pageNum} of {pdf.numPages}
          </div>
        </div>
      );
    }

    setRenderedPages(pages);
  };

  const goToPage = () => {
    if (!numPages || !containerRef.current) return;

    const pageNum = parseInt(pageInput, 10);
    if (isNaN(pageNum) || pageNum < 1 || pageNum > numPages) {
      alert(`Please enter a valid page number between 1 and ${numPages}`);
      return;
    }

    const pageElement = document.getElementById(`page-${pageNum}`);
    if (pageElement) {
      pageElement.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPageInput(e.target.value);
  };

  const handlePageInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      goToPage();
    }
  };

  const zoomOut = () => {
    setScale((prev) => Math.max(0.5, prev - 0.1));
  };

  const zoomIn = () => {
    setScale((prev) => Math.min(2, prev + 0.1));
  };

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
    <div className="h-full flex flex-col">
      {/* Header Bar (Page Picker) */}
      <div className="shrink-0 flex items-center justify-between p-2 border-b border-border bg-white">
        <div className="font-medium truncate">{file.name}</div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={zoomOut}
            disabled={scale <= 0.5}
          >
            <ZoomOut size={16} />
          </Button>
          <span className="text-sm">{Math.round(scale * 100)}%</span>
          <Button
            variant="outline"
            size="sm"
            onClick={zoomIn}
            disabled={scale >= 2}
          >
            <ZoomIn size={16} />
          </Button>
          <Input
            type="number"
            placeholder="Page #"
            value={pageInput}
            onChange={handlePageInputChange}
            onKeyDown={handlePageInputKeyDown}
            className="w-24 h-9 text-sm"
            min={1}
            max={numPages || undefined}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={goToPage}
            disabled={isLoading || !numPages}
          >
            Go
          </Button>
          <div className="text-sm ml-2 text-muted-foreground">
            {numPages ? `${numPages} pages` : "Loading..."}
          </div>
        </div>
      </div>

      {/* PDF Scroll Area */}
      <div className="flex-1 min-w-0 overflow-auto bg-[#f5f5f5]">
        <div className="min-w-max p-4 flex flex-col items-center">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <p>Loading PDF...</p>
            </div>
          ) : (
            renderedPages
          )}
        </div>
      </div>
    </div>
  );
};

export default PdfViewer;
