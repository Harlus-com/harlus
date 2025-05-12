import { ChatSourceComment, HighlightArea, BoundingBox } from "@/api/comment_types";
import { ChatSourceCommentGroup } from "@/chat/chat_types";

// Mock bounding box for highlighting text
const mockBoundingBox: BoundingBox = {
  left: 10,
  top: 35,
  width: 80,
  height: 38,
  page: 0 // First page (0-indexed)
};

// Mock highlight area containing one bounding box
const mockHighlightArea: HighlightArea = {
  boundingBoxes: [mockBoundingBox]
};

// Mock chat source comment
const mockSourceComment: ChatSourceComment = {
  id: "mock-source-comment-1",
  filePath: "C:\\Users\\info\\AppData\\Local\\electron\\Electron\\Harlus\\AAPL\\Telescope_25_Q2_China_Tarrifs_pdf\\content.pdf",
  threadId: "mock-thread-1",
  messageId: "mock-message-1",
  commentGroupId: "mock-comment-group-1",
  text: "Apple was less impacted by the tarrifs than other U.S. hardware firms",
  highlightArea: mockHighlightArea,
  nextChatCommentId: ""
};

// Mock source comment group (to be used with SourceBadge)
export const mockSourceCommentGroup: ChatSourceCommentGroup = {
  filePath: "C:\\Users\\info\\AppData\\Local\\electron\\Electron\\Harlus\\AAPL\\Telescope_25_Q2_China_Tarrifs_pdf\\content.pdf",
  chatSourceComments: [mockSourceComment]
};
