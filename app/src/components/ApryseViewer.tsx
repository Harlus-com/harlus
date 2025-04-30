import React, { useRef, useEffect } from "react";
import WebViewer from "@pdftron/webviewer";
import { WorkspaceFile } from "@/api/types";
import { BASE_URL } from "@/api/client";

type PdfViewerProps = {
  file: WorkspaceFile;
};

// Apryse must recognize a "path" parameter that starts with "/" and ends in ".pdf".
// If not, it will not even try to load the file. Go figure.
// We ignore this and just use the file id to look it up.
const PLACE_HOLDER_FILE_PATH = encodeURIComponent("/file.pdf");

const PdfViewer: React.FC<PdfViewerProps> = ({ file }) => {
  const viewerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<any>(null);

  useEffect(() => {
    // If no file is selected, don't initialize the viewer
    if (!file) return;

    console.log("apryse viewerfile", file);

    // Clean up previous instance if it exists
    if (instanceRef.current) {
      try {
        // Try to dispose the instance without affecting the DOM
        instanceRef.current.dispose();
      } catch (error) {
        console.error("Error disposing WebViewer instance:", error);
      }
      instanceRef.current = null;
    }
    WebViewer(
      {
        path: "lib",
        // Aprse also doesn't seem to accept anything other than "path" as query params
        initialDoc: `${BASE_URL}/file/apryse/pdf/${file.id}?path=${PLACE_HOLDER_FILE_PATH}`,
        licenseKey:
          "demo:1745047354914:610924870300000000e4c1d7c5ac3e5f40d263d81ec2501b59ead24a77",
      },
      viewerRef.current as HTMLDivElement
    ).then((instance) => {
      console.log("Instance", instance);
      instanceRef.current = instance;
      const { documentViewer, annotationManager, Annotations, Math } = instance.Core;
      instance.UI.enableFeatures([instance.UI.Feature.InlineComment]);
      documentViewer.addEventListener("documentLoaded", () => {
        console.log("Document loaded");

        // apply annotations
        if (file.annotations?.show && file.annotations?.data) {
          console.log("Applying annotations", file.annotations.data);
          // TODO: Apply annotations from file.annotations.data
          const annotationBboxes = file.annotations.data
          console.log("annotationBboxes", annotationBboxes);
          let appliedCount = 0;
          let isFirstAnnotation = true;
          annotationBboxes.forEach((bbox, index) => {
            console.log(`PDF handler: Processing annotation ${index + 1}/${annotationBboxes.length}`);
            try {
                const PageNumber = bbox.p;
                const RectObj = new Math.Rect(
                    bbox.x, 
                    bbox.y, 
                    bbox.x + bbox.w, 
                    bbox.y + bbox.h
                );
                const Quad = RectObj.toQuad();
                const annot = new Annotations.TextHighlightAnnotation({
                    PageNumber: PageNumber,
                    Quads: [Quad],
                    StrokeColor: new Annotations.Color(0, 0, 128, 0.15),
                    isHoverable: true,
                    isHovering: true,
                    Author: "Harlus",
                    ReadOnly: true,
                });
                annot.setContents(""); // insert content here
                annotationManager.addAnnotation(annot);
                annotationManager.redrawAnnotation(annot);
                appliedCount++;
                if (isFirstAnnotation) {
                    documentViewer.setCurrentPage(PageNumber,true);
                    isFirstAnnotation = false;
                }
            } catch (error) {
                console.error(`PDF handler: Error applying annotation: ${error.message}`);
            }
          });
        }
      });
      instance.UI.addEventListener("loaderror", (e) => {
        console.error("Document failed to load", e);
      });
    });

    // Cleanup function
    return () => {
      if (instanceRef.current) {
        try {
          // Try to dispose the instance without affecting the DOM
          instanceRef.current.UI.dispose();
        } catch (error) {
          console.error("Error disposing WebViewer instance:", error);
        }
        instanceRef.current = null;
      }
    };
  }, [file]);

  if (!file) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        Select a PDF file to view
      </div>
    );
  }

  return (
    <div className="h-full">
      <div className="webviewer h-full" ref={viewerRef}></div>
    </div>
  );
};

export default PdfViewer;
