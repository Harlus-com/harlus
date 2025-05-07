// API Response

export interface CommentGroup {
  readonly id: string;
  readonly name: string;
}

// REMEMBER THIS HAS TO BE FOR ReactPdfVieiwer, which uses percentages
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
  // Page number to jump to when the highlight is clicked note: the comment could span multiplage pages hence "jumpTo"
  readonly jumpToPageNumber: number; // This is 1-based -- TODO: Make this 0-based for consistency
}

export interface ClaimComment {
  readonly id: string;
  readonly filePath: string;
  readonly commentGroupId: string;
  readonly text: string;
  readonly highlightArea: HighlightArea;
  readonly links: LinkComment[];
  // This is used for formatting
  readonly verdict: "true" | "false" | "unknown";
}

export interface ChatSourceComment {
  readonly id: string;
  readonly filePath: string;
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
  readonly filePath: string;
  readonly commentGroupId: string;
  // We might consider deleting this. Right now we generate the text for a link comment statically in comment_converters.ts
  readonly text: string; // e.g. Why the text is relevant to the claim in the parent comment
  readonly highlightArea: HighlightArea;
  readonly parentCommentId: string;
}
