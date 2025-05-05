// This file contians functions to convert API comment types to a universal UI comment type that the PDF viewer can render.

import { ClaimComment, CommentGroupId, HighlightArea, LinkComment } from "@/api/comment_types";
import { fileService } from "@/api/fileService";
import { Comment, ReactPdfAnnotation } from "./comment_ui_types";
import { WorkspaceFile } from "@/api/types";

export async function convertClaimCommentToComments(
  claim: ClaimComment,
  group: CommentGroupId
): Promise<Comment[]> {
  const file = await fileService.lookupFileByPath(claim.filePath);
  const links = await Promise.all(claim.links.map(convertLinkCommentToLink));
  const comment: Comment = {
    id: claim.id,
    fileId: file.id,
    groupId: group.id,
    body: claim.text,
    author: "Harlus",
    timestamp: new Date(),
    annotations: convertHighlightAreaToAnnotations(claim.highlightArea),
    links,
    jumpToPageNumber: claim.highlightArea.jumpToPageNumber,
  };
  if (claim.verdict === "true") {
    comment.header = "Alignment";
  } else if (claim.verdict === "false") {
    comment.header = "Contradiction";
  }
  const comments: Comment[] = [comment];
  for (const link of claim.links) {
    const comment = await convertLinkCommentToComment(link, claim, file, group);
    comments.push(comment);
  }
  return comments;
}

async function convertLinkCommentToLink(comment: LinkComment) {
  const file = await fileService.lookupFileByPath(comment.filePath);
  return {
    linkToCommentId: comment.id,
    text: `${file.name}, page ${comment.highlightArea.jumpToPageNumber}`,
  };
}

async function convertLinkCommentToComment(
  comment: LinkComment,
  parentComment: ClaimComment,
  parentFile: WorkspaceFile,
  group: CommentGroupId
): Promise<Comment> {
  const file = await fileService.lookupFileByPath(comment.filePath);
  return {
    id: comment.id,
    fileId: file.id,
    groupId: group.id,
    body: `${
      parentComment.verdict === "true" ? "Supports" : "Contradicts"
    } claim in ${parentFile.name}`,
    author: "Harlus",
    timestamp: new Date(),
    annotations: convertHighlightAreaToAnnotations(comment.highlightArea),
    links: [
      {
        linkToCommentId: parentComment.id,
        text: `${parentFile.name}, page ${parentComment.highlightArea.jumpToPageNumber}`,
      },
    ],
    jumpToPageNumber: comment.highlightArea.jumpToPageNumber,
  };
}

function convertHighlightAreaToAnnotations(
  highlightArea: HighlightArea
): ReactPdfAnnotation[] {
  return highlightArea.boundingBoxes.map((boundingBox) => {
    return {
      id: "DELETE IF WE CAN",
      pageNumber: boundingBox.page,
      left: boundingBox.left,
      top: boundingBox.top,
      width: boundingBox.width,
      height: boundingBox.height,
    };
  });
}
