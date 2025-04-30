import React, { useState } from "react";
import PdfViewer from "@/components/PDFViewer";

export default function AppLayout() {
  const [leftWidth, setLeftWidth] = useState(250);
  const [rightWidth, setRightWidth] = useState(250);
  const minSidebar = 0;
  const maxSidebar = 400;

  return (
    <div className="flex flex-col min-w-[800px] min-h-[600px] w-full h-screen">
      {/* Header */}
      <div className="h-16 bg-gray-800 text-white flex items-center px-4">
        <h1 className="text-xl">Header Area</h1>
      </div>

      {/* Main area with side panels */}
      <div className="flex flex-1 overflow-hidden">
        {/* Area 1 (Left Sidebar) */}
        <div
          className="bg-gray-100 overflow-auto resize-x"
          style={{
            width: `${leftWidth}px`,
            minWidth: `${minSidebar}px`,
            maxWidth: `${maxSidebar}px`,
          }}
        >
          <div className="h-full p-4">Left Sidebar (Area 1)</div>
        </div>

        {/* Drag handle for Area 1 */}
        <div
          className="w-2 cursor-col-resize bg-gray-300 hover:bg-gray-400"
          onMouseDown={(e) => startDrag(e, "left")}
        />

        {/* Area 2 (Main content) */}
        <div className="flex-1 bg-white overflow-auto">
          <PdfViewer
            file={{
              id: "1",
              path: "/Users/danielglasgow/Desktop/example.pdf",
              name: "AAPL_10-Q.pdf",
            }}
          />
        </div>

        {/* Drag handle for Area 3 */}
        <div
          className="w-2 cursor-col-resize bg-gray-300 hover:bg-gray-400"
          onMouseDown={(e) => startDrag(e, "right")}
        />

        {/* Area 3 (Right Sidebar) */}
        <div
          className="bg-gray-100 overflow-auto resize-x"
          style={{
            width: `${rightWidth}px`,
            minWidth: `${minSidebar}px`,
            maxWidth: `${maxSidebar}px`,
          }}
        >
          <div className="h-full p-4">Right Sidebar (Area 3)</div>
        </div>
      </div>
    </div>
  );

  function startDrag(e: React.MouseEvent, side: "left" | "right") {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = side === "left" ? leftWidth : rightWidth;

    function onMouseMove(ev: MouseEvent) {
      const delta = ev.clientX - startX;
      if (side === "left") {
        setLeftWidth(
          Math.min(Math.max(startWidth + delta, minSidebar), maxSidebar)
        );
      } else {
        setRightWidth(
          Math.min(Math.max(startWidth - delta, minSidebar), maxSidebar)
        );
      }
    }

    function onMouseUp() {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }
}
