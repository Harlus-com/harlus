// API Response

import { Timestamp } from "./common_api_types";

export interface CommentGroup {
  readonly id: string;
  readonly name: string;
  readonly createdAt: Timestamp;
}

// REMEMBER THIS HAS TO BE FOR ReactPdfVieiwer, which uses percentages
// TODO: Replace this with the HighlightArea type from @react-pdf-viewer/highlight
export interface BoundingBox {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  // Page where this bounding box get's rendered. Helpful when a highligh area spans multiple pages.
  readonly page: number; // This is 0-based
}

export interface HighlightArea {
  readonly boundingBoxes: BoundingBox[]; // Array of bounding boxes that make up the highlight area
}

export interface ClaimComment {
  readonly id: string;
  readonly fileId: string;
  readonly commentGroupId: string;
  readonly text: string;
  readonly highlightArea: HighlightArea;
  readonly links: LinkComment[];
  // This is used for formatting
  readonly verdict: "true" | "false" | "unknown";
}

export interface ChatSourceComment {
  readonly id: string;
  readonly fileId: string;
  readonly threadId: string;
  readonly messageId: string; // Could be used to scroll back in the thread to the original message with the source
  readonly commentGroupId: string;
  readonly text: string; // In original version something generic like "Response source"
  readonly highlightArea: HighlightArea;
  readonly nextChatCommentId: string; // Links to the next source comment associated with the chat
}

/*
 * Higlights a specific area of text in a file, and links back to the "origin comment".
 */
export interface LinkComment {
  readonly id: string;
  readonly fileId: string;
  readonly commentGroupId: string;
  // We might consider deleting this. Right now we generate the text for a link comment statically in comment_converters.ts
  readonly text: string; // e.g. Why the text is relevant to the claim in the parent comment
  readonly highlightArea: HighlightArea;
  readonly parentCommentId: string;
}
