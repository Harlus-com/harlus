import { ClaimComment, LinkComment } from "@/api/comment_types";

// Mock response from runContrastAnalysis
export const mockContrastAnalysisResponse: { claimComments: ClaimComment[] } = {
  claimComments: [
    // Comment on the 3‑page document (page 3) with evidence in the 13‑page doc
    {
      id: "c1",
      filePath:
        "C:\\Users\\info\\AppData\\Local\\electron\\Electron\\Harlus\\AAPL\\17_Q3_analysis_pdf\\content.pdf",
      commentGroupId: "g1",
      text: "The conclusion section over‑simplifies the contributing factors.",
      highlightArea: {
        boundingBoxes: [{ left: 5, top: 80, width: 90, height: 10, page: 0 }],
      },
      links: [
        {
          id: "l1",
          filePath:
            "C:\\Users\\info\\AppData\\Local\\electron\\Electron\\Harlus\\AAPL\\24_Q1_pdf\\content.pdf",
          text: "See detailed factor breakdown in Section 7.2",
          highlightArea: {
            boundingBoxes: [
              { left: 10, top: 15, width: 80, height: 12, page: 0 },
            ],
          },
          parentCommentId: "c1",
        },
      ] as LinkComment[],
      verdict: "true",
    },

    // Another comment on the 3‑page document (page 2) with two pieces of evidence
    {
      id: "c2",
      filePath:
      "C:\\Users\\info\\AppData\\Local\\electron\\Electron\\Harlus\\AAPL\\17_Q3_analysis_pdf\\content.pdf",
      commentGroupId: "g1",
      text: "Figure reference lacks proper context in the methodology section.",
      highlightArea: {
        boundingBoxes: [{ left: 12, top: 40, width: 76, height: 8, page: 0 }],
      },
      links: [
        {
          id: "l2",
          filePath:
          "C:\\Users\\info\\AppData\\Local\\electron\\Electron\\Harlus\\AAPL\\24_Q1_pdf\\content.pdf",
          text: "Comparison figure in Doc2, page 10 shows context.",
          highlightArea: {
            boundingBoxes: [
              { left: 8, top: 50, width: 84, height: 10, page: 0 },
            ],
          },
          parentCommentId: "c2",
        },
        {
          id: "l3",
          filePath:
          "C:\\Users\\info\\AppData\\Local\\electron\\Electron\\Harlus\\AAPL\\24_Q1_pdf\\content.pdf",
          text: "Additional legend explanation on page 11.",
          highlightArea: {
            boundingBoxes: [
              { left: 15, top: 20, width: 70, height: 7, page: 0 },
            ],
          },
          parentCommentId: "c2",
        },
      ] as LinkComment[],
      verdict: "false",
    },
  ],
};