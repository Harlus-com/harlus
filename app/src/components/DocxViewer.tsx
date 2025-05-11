import React, { useState, useRef } from "react";

/**
 * Word viewer that cleanly swaps between two SharePoint documents.
 *
 * • Shows header with **Accept updates** while viewing *source 1*.
 * • On click → header disappears immediately, spinner overlays source 1.
 * • When *source 2* finishes loading → swaps iframe, removes spinner.
 * • Header never returns.
 */
export interface DocxViewerProps {
  src?: string;         // original document
  updatedSrc?: string;  // document after accepting updates
}

const DEFAULT_SRC =
  "https://harlusai-my.sharepoint.com/personal/octave_oliviers_harlus_com/_layouts/15/Doc.aspx?sourcedoc={cc203af2-c6f7-493a-9c5a-da3730f475af}&action=embedview";
const DEFAULT_UPDATED_SRC =
  "https://harlusai-my.sharepoint.com/personal/octave_oliviers_harlus_com/_layouts/15/Doc.aspx?sourcedoc={6742a637-7c49-478e-85f6-135a3cb98e8b}&action=embedview";

export default function DocxViewer({
  src = DEFAULT_SRC,
  updatedSrc = DEFAULT_UPDATED_SRC,
}: DocxViewerProps) {
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
        title="Word Viewer"
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