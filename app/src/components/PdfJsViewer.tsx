import React, { useEffect, useRef } from "react";
import * as pdfjsLib from "pdfjs-dist";
/**
 * Might need to add this in the future:
 * export default defineConfig({
 * optimizeDeps: {
 *  include: ['pdfjs-dist/build/pdf.worker.mjs']
 * }
 * });
 */
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { getDocument } from "pdfjs-dist";

// Set worker path
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

type PdfViewerProps = {
  filePath: string;
};

const PdfViewer: React.FC<PdfViewerProps> = ({ filePath }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const loadAndRender = async () => {
      const pdfData: ArrayBuffer = await window.electron.getFileContent(
        filePath
      );
      const pdf = await getDocument({ data: pdfData }).promise;
      const page = await pdf.getPage(1);

      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = canvasRef.current!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const context = canvas.getContext("2d")!;
      await page.render({ canvasContext: context, viewport }).promise;
    };

    loadAndRender();
  }, [filePath]);

  return <canvas ref={canvasRef} style={{ width: "100%", height: "auto" }} />;
};

export default PdfViewer;
