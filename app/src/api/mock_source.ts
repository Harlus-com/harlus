import { ChatSourceComment, HighlightArea, BoundingBox } from "@/api/comment_types";
import { ChatSourceCommentGroup } from "@/chat/chat_types";

// Mock bounding box for highlighting text
const mockBoundingBox: BoundingBox = {
  left: 10,
  top: 50,
  width: 80,
  height: 20,
  page: 0 // First page (0-indexed)
};

// Mock highlight area containing one bounding box
const mockHighlightArea: HighlightArea = {
  boundingBoxes: [mockBoundingBox]
};

// Mock chat source comment
const mockSourceComment: ChatSourceComment = {
  id: "mock-source-comment-1",
  filePath: "C:\\Users\\info\\AppData\\Local\\electron\\Electron\\Harlus\\AAPL\\10_Q4_2024_Earnings_Transcript_pdf\\content.pdf",
  threadId: "mock-thread-1",
  messageId: "mock-message-1",
  commentGroupId: "mock-comment-group-1",
  text: "Source from sell-side report confirming trend",
  highlightArea: mockHighlightArea,
  nextChatCommentId: ""
};

// Mock source comment group (to be used with SourceBadge)
export const mockSourceCommentGroup: ChatSourceCommentGroup = {
  filePath: "C:\\Users\\info\\AppData\\Local\\electron\\Electron\\Harlus\\AAPL\\10_Q4_2024_Earnings_Transcript_pdf\\content.pdf",
  chatSourceComments: [mockSourceComment]
};
