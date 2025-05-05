import { ClaimComment, LinkComment } from '@/api/comment_types';

// Mock response from runContrastAnalysis
export const mockContrastAnalysisResponse: { claimComments: ClaimComment[] } = {
  claimComments: [
    // Comment on the 3‑page document (page 3) with evidence in the 13‑page doc
    {
      id: 'c1',
      filePath: 'doc1.pdf',
      commentGroupId: 'g1',
      text: 'The conclusion section over‑simplifies the contributing factors.',
      highlightArea: {
        boundingBoxes: [
          { left: 5, top: 80, width: 90, height: 10, page: 3 },
        ],
        jumpToPageNumber: 3,
      },
      links: [
        {
          id: 'l1',
          filePath: 'doc2.pdf',
          text: 'See detailed factor breakdown in Section 7.2',
          highlightArea: {
            boundingBoxes: [
              { left: 10, top: 15, width: 80, height: 12, page: 7 },
            ],
            jumpToPageNumber: 7,
          },
          parentCommentId: 'c1',
        },
      ] as LinkComment[],
      verdict: 'true',
    },

    // Another comment on the 3‑page document (page 2) with two pieces of evidence
    {
      id: 'c2',
      filePath: 'doc1.pdf',
      commentGroupId: 'g1',
      text: 'Figure reference lacks proper context in the methodology section.',
      highlightArea: {
        boundingBoxes: [
          { left: 12, top: 40, width: 76, height: 8, page: 2 },
        ],
        jumpToPageNumber: 2,
      },
      links: [
        {
          id: 'l2',
          filePath: 'doc2.pdf',
          text: 'Comparison figure in Doc2, page 10 shows context.',
          highlightArea: {
            boundingBoxes: [
              { left: 8, top: 50, width: 84, height: 10, page: 10 },
            ],
            jumpToPageNumber: 10,
          },
          parentCommentId: 'c2',
        },
        {
          id: 'l3',
          filePath: 'doc2.pdf',
          text: 'Additional legend explanation on page 11.',
          highlightArea: {
            boundingBoxes: [
              { left: 15, top: 20, width: 70, height: 7, page: 11 },
            ],
            jumpToPageNumber: 11,
          },
          parentCommentId: 'c2',
        },
      ] as LinkComment[],
      verdict: 'unknown',
    },
  ],
};