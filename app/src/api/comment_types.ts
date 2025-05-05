// API Response

export interface CommentGroupId {
  readonly id: string;
  readonly name: string;
}


// ASSUME THAT ALL REFERENCE TO filePath means filePath when returned from the API

// REMEMBER THIS HAS TO BE FOR ReactPdfVieiwer, which uses percentages
export interface BoundingBox {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly page: number; // Page where this bounding box get's rendered. Helpful when a highligh area spans multiple pages.
}

export interface HighlightArea {
  readonly boundingBoxes: BoundingBox[]; // Array of bounding boxes that make up the highlight area
  // Page number to jump to when the highlight is clicked note: the comment could span multiplage pages hence "jumpTo"
  readonly jumpToPageNumber: number;
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
  readonly text: string; // e.g. Why the text is relevant to the claim in the parent comment
  readonly highlightArea: HighlightArea;
  readonly parentCommentId: string;
}

