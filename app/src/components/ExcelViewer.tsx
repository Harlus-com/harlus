import React, { useState, useRef } from "react";

export interface ExcelViewerProps {
  src?: string;         // original document
  updatedSrc?: string;  // document after accepting updates
}

const DEFAULT_SRC =
  "https://harlusai.sharepoint.com/sites/documents/_layouts/15/Doc.aspx?sourcedoc={728989a7-bda1-4217-8f77-226c717c6481}&action=embedview&wdAllowInteractivity=False&AllowTyping=True&ActiveCell='FCF%20Estimates'!G1&wdHideGridlines=True&wdHideHeaders=True&wdInConfigurator=True&wdInConfigurator=True";
const DEFAULT_UPDATED_SRC =
  "https://harlusai.sharepoint.com/sites/documents/_layouts/15/Doc.aspx?sourcedoc={edfb08fc-d8b8-4fda-88c5-71be1b84df29}&action=embedview&wdAllowInteractivity=False&AllowTyping=True&ActiveCell='FCF%20Estimates'!G1&wdHideGridlines=True&wdHideHeaders=True&wdInConfigurator=True&wdInConfigurator=True";

export default function ExcelViewer({
  src = DEFAULT_SRC,
  updatedSrc = DEFAULT_UPDATED_SRC,
}: ExcelViewerProps) {
  /** src *currently* visible to the user */
  const [visibleSrc, setVisibleSrc] = useState(src);
  /** has the user clicked “Accept updates”? */
  const [accepted, setAccepted] = useState(false);
  /** true while we preload source 2 */
  const [loading, setLoading] = useState(false);
  /** URL being preloaded (null when not preloading) */
  const preloadSrcRef = useRef<string | null>(null);

  const startSwap = () => {
    setAccepted(true);          // header disappears right away
    setLoading(true);           // spinner appears
    preloadSrcRef.current = updatedSrc.includes("wdStartOn=")
      ? updatedSrc
      : `${updatedSrc}&wdStartOn=1`;
  };

  const finishSwap = () => {
    if (preloadSrcRef.current) {
      setVisibleSrc(preloadSrcRef.current); // show source 2
      preloadSrcRef.current = null;
    }
    setLoading(false);           // hide spinner
  };

  return (
    <div className="relative h-full w-full flex flex-col">
      {/* Header only before acceptance */}
      {!accepted && (
        <header className="flex-none bg-gray-100 border-b px-3 py-2 text-sm font-medium flex justify-end">
          <button
            type="button"
            className="text-blue-600 hover:text-blue-800"
            onClick={startSwap}
          >
            Accept updates
          </button>
        </header>
      )}

      {/* Spinner overlay while preload iframe boots */}
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <span className="animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent" />
        </div>
      )}

      {/* Currently visible document */}
      <iframe
        key={visibleSrc}
        src={visibleSrc}
        title="Excel Viewer"
        width="100%"
        height="100%"
        frameBorder="0"
        className="flex-1 border-none"
        allow="clipboard-read clipboard-write fullscreen"
      />

      {/* Preload source 2 (hidden) */}
      {loading && preloadSrcRef.current && (
        <iframe
          key={preloadSrcRef.current}
          src={preloadSrcRef.current}
          width="0"
          height="0"
          className="opacity-0 invisible absolute"
          aria-hidden="true"
          onLoad={finishSwap}
        />
      )}
    </div>
  );
}