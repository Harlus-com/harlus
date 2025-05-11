import { ClaimComment, LinkComment } from "@/api/comment_types";

// Mock response from runContrastAnalysis
export const mockContrastAnalysisResponse: { claimComments: ClaimComment[] } = {
  claimComments: [
    // Comment on the 3‑page document (page 3) with evidence in the 13‑page doc
    {
      id: "c1",
      filePath:
        "C:\\Users\\info\\AppData\\Local\\electron\\Electron\\Harlus\\AAPL\\25_Q1_update_pdf\\content.pdf",
      commentGroupId: "g1",
      text: "Markets with Apple Intelligence have stronger iPhone sales.",
      highlightArea: {
        boundingBoxes: [
          { left: 58.60, top: 57.60, width: 26.67, height: 1.70, page: 0 },
          { left: 14.71, top: 59.56, width: 40, height: 1.70, page: 0 }
        ]
      },
      links: [
        {
          id: "c1-l1",
          filePath:
            "C:\\Users\\info\\AppData\\Local\\electron\\Electron\\Harlus\\AAPL\\25_Q2_pdf\\content.pdf",
          text: "",
          highlightArea: {
            boundingBoxes: [
              { left: 39.39, top: 38.73, width: 48.40, height: 1.42, page: 15 },
              { left: 12.11, top: 40.69, width: 75.81, height: 1.42, page: 15 },
              { left: 12.11, top: 42.56, width: 66.30, height: 1.42, page: 15 }
            ]            
          },
          parentCommentId: "c1",
        },
      ] as LinkComment[],
      verdict: "true",
    },

    {
      id: "c2a",
      filePath:
      "C:\\Users\\info\\AppData\\Local\\electron\\Electron\\Harlus\\AAPL\\25_Q1_update_pdf\\content.pdf",
      commentGroupId: "g1",
      text: "Services in Q2 grew y/y with 12% at 75.7% gross margin.",
      highlightArea: {
        boundingBoxes: [
          { left: 70.97, top: 61.48, width: 14.74, height: 1.70, page: 0 },
          { left: 14.71, top: 63.44, width: 47.97, height: 1.70, page: 0 }
        ]
      },
      links: [
        {
          id: "c2a-l1",
          filePath:
          "C:\\Users\\info\\AppData\\Local\\electron\\Electron\\Harlus\\AAPL\\25_Q2_pdf\\content.pdf",
          text: "",
          highlightArea: {
            boundingBoxes: [
              { left: 12.11, top: 83.38, width: 75.86, height: 1.42, page: 2 },
              { left: 12.11, top: 85.34, width: 70.31, height: 1.42, page: 2 }
            ]            
          },
          parentCommentId: "c2a",
        },
        {
          id: "c2a-l2",
          filePath:
          "C:\\Users\\info\\AppData\\Local\\electron\\Electron\\Harlus\\AAPL\\25_Q2_pdf\\content.pdf",
          text: "",
          highlightArea: {
            boundingBoxes: [
              { left: 54.08, top: 16.00, width: 33.69, height: 1.42, page: 5 },
              { left: 12.11, top: 17.97, width: 75.89, height: 1.42, page: 5 },
              { left: 12.11, top: 19.92, width:  8.58, height: 1.42, page: 5 }
            ]            
          },
          parentCommentId: "c2a",
        },
      ] as LinkComment[],
      verdict: "true",
    },

    {
      id: "c2b",
      filePath:
      "C:\\Users\\info\\AppData\\Local\\electron\\Electron\\Harlus\\AAPL\\25_Q1_update_pdf\\content.pdf",
      commentGroupId: "g1",
      text: "Ongoing legislation and Digital Market Acts was discussed during earnings call.",
      highlightArea: {
        boundingBoxes: [
          { left: 70.97, top: 61.48, width: 14.74, height: 1.70, page: 0 },
          { left: 14.71, top: 63.44, width: 47.97, height: 1.70, page: 0 }
        ]
      },
      links: [
        {
          id: "c2b-l1",
          filePath:
          "C:\\Users\\info\\AppData\\Local\\electron\\Electron\\Harlus\\AAPL\\25_Q2_pdf\\content.pdf",
          text: "",
          highlightArea: {
            boundingBoxes: [
              { left: 61.16, top: 23.31, width: 26.63, height: 1.42, page: 18 },
              { left: 12.11, top: 25.27, width: 75.59, height: 1.42, page: 18 },
              { left: 12.11, top: 27.15, width: 75.92, height: 1.42, page: 18 },
              { left: 12.11, top: 29.10, width: 67.99, height: 1.42, page: 18 },
              { left: 12.11, top: 35.88, width: 48.59, height: 1.42, page: 18 },
              { left: 61.04, top: 35.88, width: 26.79, height: 1.42, page: 18 },
              { left: 12.11, top: 37.84, width: 12.10, height: 1.42, page: 18 }
            ]            
          },
          parentCommentId: "c2b",
        },
      ] as LinkComment[],
      verdict: "false",
    },

    {
      id: "c3",
      filePath:
      "C:\\Users\\info\\AppData\\Local\\electron\\Electron\\Harlus\\AAPL\\25_Q1_update_pdf\\content.pdf",
      commentGroupId: "g1",
      text: "Further decline in China sales with 2%.",
      highlightArea: {
        boundingBoxes: [
          { left: 37.02, top: 67.35, width: 48.21, height: 1.70, page: 0 },
          { left: 14.71, top: 69.28, width: 30.86, height: 1.70, page: 0 }
        ]
      },
      links: [
        {
          id: "c3-l1",
          filePath:
          "C:\\Users\\info\\AppData\\Local\\electron\\Electron\\Harlus\\AAPL\\25_Q2_pdf\\content.pdf",
          text: "",
          highlightArea: {
            boundingBoxes: [
              { left: 12.11, top: 70.19, width: 75.68, height: 1.42, page: 9 },
              { left: 12.11, top: 72.15, width: 75.68, height: 1.42, page: 9 },
              { left: 12.11, top: 74.12, width: 75.68, height: 1.42, page: 9 },
              { left: 12.11, top: 76.07, width: 33.45, height: 1.42, page: 9 }
            ]            
          },
          parentCommentId: "c3",
        },
        {
          id: "c3-l2",
          filePath:
          "C:\\Users\\info\\AppData\\Local\\electron\\Electron\\Harlus\\AAPL\\25_Q2_pdf\\content.pdf",
          text: "",
          highlightArea: {
            boundingBoxes: [
              { left: 47.56, top: 10.75, width: 40.23, height: 1.42, page: 10 },
              { left: 12.11, top: 12.71, width: 75.87, height: 1.42, page: 10 },
              { left: 12.11, top: 14.58, width: 75.64, height: 1.42, page: 10 },
              { left: 12.11, top: 16.54, width: 53.96, height: 1.42, page: 10 }
            ]            
          },
          parentCommentId: "c3",
        },
      ] as LinkComment[],
      verdict: "unknown",
    },

    {
      id: "c4",
      filePath:
      "C:\\Users\\info\\AppData\\Local\\electron\\Electron\\Harlus\\AAPL\\25_Q1_update_pdf\\content.pdf",
      commentGroupId: "g1",
      text: "Impact from tarrifs for Q2 estimated at $900M.",
      highlightArea: {
        boundingBoxes: [
          { left: 47.44, top: 87.69, width: 34.68, height: 1.70, page: 0 }
        ],
      },
      links: [
        {
          id: "c4-l1",
          filePath:
          "C:\\Users\\info\\AppData\\Local\\electron\\Electron\\Harlus\\AAPL\\25_Q2_pdf\\content.pdf",
          text: "",
          highlightArea: {
            boundingBoxes: [
              { left: 58.75, top: 23.31, width: 29.03, height: 1.42, page: 4 },
              { left: 12.11, top: 25.27, width: 75.74, height: 1.42, page: 4 },
              { left: 12.11, top: 27.15, width: 75.67, height: 1.42, page: 4 },
              { left: 12.11, top: 29.10, width: 67.52, height: 1.42, page: 4 },
              { left: 12.11, top: 32.49, width: 75.68, height: 1.42, page: 4 },
              { left: 12.11, top: 34.45, width: 75.69, height: 1.42, page: 4 },
              { left: 12.11, top: 36.41, width: 75.90, height: 1.42, page: 4 },
              { left: 12.11, top: 38.29, width: 75.72, height: 1.42, page: 4 },
              { left: 12.11, top: 40.25, width: 14.37, height: 1.42, page: 4 }
            ]            
          },
          parentCommentId: "c4",
        },
        {
          id: "c4-l2",
          filePath:
          "C:\\Users\\info\\AppData\\Local\\electron\\Electron\\Harlus\\AAPL\\25_Q2_pdf\\content.pdf",
          text: "",
          highlightArea: {
            boundingBoxes: [
              { left: 31.87, top: 67.79, width: 55.92, height: 1.42, page: 7 },
              { left: 12.11, top: 69.66, width: 40.26, height: 1.42, page: 7 }
            ]            
          },
          parentCommentId: "c4",
        },
        {
          id: "c4-l3",
          filePath:
          "C:\\Users\\info\\AppData\\Local\\electron\\Electron\\Harlus\\AAPL\\25_Q2_pdf\\content.pdf",
          text: "",
          highlightArea: {
            boundingBoxes: [
              { left: 16.13, top: 64.76, width: 71.69, height: 1.42, page: 11 },
              { left: 12.11, top: 66.72, width: 75.80, height: 1.42, page: 11 },
              { left: 12.11, top: 68.68, width: 72.39, height: 1.42, page: 11 },
              { left: 12.11, top: 75.36, width: 75.93, height: 1.42, page: 11 },
              { left: 12.11, top: 77.32, width: 73.77, height: 1.42, page: 11 }
            ]            
          },
          parentCommentId: "c4",
        },
      ] as LinkComment[],
      verdict: "false",
    },

    {
      id: "c5",
      filePath:
      "C:\\Users\\info\\AppData\\Local\\electron\\Electron\\Harlus\\AAPL\\25_Q1_update_pdf\\content.pdf",
      commentGroupId: "g1",
      text: "Significant $500B CAPEX investments announced in latest earnings call.",
      highlightArea: {
        boundingBoxes: [
          { left: 37.38, top: 11.06, width: 12.88, height: 1.70, page: 1 }
        ]
      },
      links: [
        {
          id: "c5-l1",
          filePath:
          "C:\\Users\\info\\AppData\\Local\\electron\\Electron\\Harlus\\AAPL\\25_Q2_pdf\\content.pdf",
          text: "",
          highlightArea: {
            boundingBoxes: [
              { left: 12.11, top: 36.24, width: 75.70, height: 1.42, page: 16 },
              { left: 12.11, top: 38.20, width: 75.69, height: 1.42, page: 16 },
              { left: 12.11, top: 46.84, width: 75.68, height: 1.42, page: 16 },
              { left: 12.11, top: 48.80, width: 75.67, height: 1.42, page: 16 },
              { left: 12.11, top: 50.76, width: 75.93, height: 1.42, page: 16 },
              { left: 12.11, top: 52.72, width: 42.92, height: 1.42, page: 16 }
            ]
            
          },
          parentCommentId: "c5",
        },
      ] as LinkComment[],
      verdict: "unknown",
    },
  ],
};