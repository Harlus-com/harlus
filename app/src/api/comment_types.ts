// API Response

// ASSUME THAT ALL REFERENCE TO fileId means FILE_PATH when returned from the API

// REMEMBER THIS HAS TO BE FOR ReactPdfVieiwer, which uses percentages
interface BoundingBox {
  left: number;
  top: number;
  width: number;
  height: number;
  page: number; // Page where this bounding box get's rendered. Helpful when a highligh area spans multiple pages.
}

interface HighlightArea {
  boundingBoxes: BoundingBox[]; // Array of bounding boxes that make up the highlight area
  // Page number to jump to when the highlight is clicked note: the comment could span multiplage pages hence "jumpTo"
  jumpToPageNumber: number;
}

interface ClaimComment {
  id: string;
  fileId: string;
  text: string;
  highlightArea: HighlightArea;
  links: LinkComment[];
  // This is used for formatting
  verdict: "true" | "false" | "unknown";
}

interface ChatSourceComment {
  id: string;
  fileId: string;
  threadId: string;
  messageId: string; // Could be used to scroll back in the thread to the original message with the source
  text: string; // In original version something generic like "Response source"
  highlightArea: HighlightArea;
  nextChatCommentId: string; // Links to the next source comment associated with the chat 
}

/*
 * Higlights a specific area of text in a file, and links back to the "origin comment".
 */
interface LinkComment {
  id: string;
  fileId: string;
  text: string; // e.g. Why the text is relevant to the claim in the parent comment
  highlightArea: HighlightArea;
  parentCommentId: string;
}

