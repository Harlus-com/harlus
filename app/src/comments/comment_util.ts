import { BoundingBox, ClaimComment } from "@/api/comment_types";
import { CommentColor, ReadonlyComment } from "./comment_ui_types";
import { HighlightArea } from "@react-pdf-viewer/highlight";

import { CommentState } from "./comment_ui_types";

import { CommentComponentData } from "./comment_ui_types";

export function updateUiState(
  comment: CommentComponentData,
  update: Partial<CommentState>
): CommentComponentData {
  return {
    apiData: comment.apiData,
    uiState: {
      ...comment.uiState,
      ...update,
    },
  };
}

export function getCommentColor(claim: ClaimComment): CommentColor {
  switch (claim.verdict) {
    case "true":
      return CommentColor.GREEN;
    case "false":
      return CommentColor.RED;
    default:
      return CommentColor.NONE;
  }
}

export function copyToReadonly(comment: CommentComponentData): ReadonlyComment {
  return {
    ...comment.apiData,
    ...comment.uiState,
  };
}

export function getHighestZeroIndexedPageNumber(
  boundingBoxes: BoundingBox[]
): number | null {
  if (!boundingBoxes || boundingBoxes.length === 0) {
    return null;
  }
  return boundingBoxes.reduce((max, box) => Math.max(max, box.page), 0);
}

export function getHighestZeroIndexedPageNumberFromHighlightArea(
  areas: HighlightArea[]
): number | null {
  if (!areas || areas.length === 0) {
    return null;
  }
  return areas.reduce((max, box) => Math.max(max, box.pageIndex), 0);
}
