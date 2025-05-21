// This file contians functions to convert API comment types to a universal UI comment type that the PDF viewer can render.

import {
  ClaimComment,
  CommentGroup,
  HighlightArea,
  LinkComment,
  ChatSourceComment,
} from "@/api/comment_types";
import { HighlightArea as ReactPdfHighlightArea } from "@react-pdf-viewer/highlight";
import { Comment, CommentLink, CommentTag } from "./comment_ui_types";
import { WorkspaceFile } from "@/api/workspace_types";
import { getHighestZeroIndexedPageNumber } from "./comment_util";

export class CommentConverter {
  constructor(private readonly getFile: (fileId: string) => WorkspaceFile) {}

  async convertClaimCommentToComments(
    claim: ClaimComment,
    group: CommentGroup
  ): Promise<Comment[]> {
    const links = await Promise.all(
      claim.links.map((l) => this.convertLinkCommentToLink(l))
    );
    const comment: Comment = {
      id: claim.id,
      fileId: claim.fileId,
      groupId: group.id,
      body: claim.text,
      author: "Harlus",
      timestamp: new Date(),
      annotations: convertHighlightAreaToAnnotations(claim.highlightArea),
      links,
    };
    console.log("VERDICT", claim.verdict);
    if (claim.verdict === "true") {
      comment.tag = CommentTag.ALIGNMENT;
    } else if (claim.verdict === "false") {
      comment.tag = CommentTag.CONTRADICTION;
    }
    const comments: Comment[] = [comment];
    const file = this.getFile(claim.fileId);
    for (const link of claim.links) {
      const comment = await this.convertLinkCommentToComment(
        link,
        claim,
        file,
        group
      );
      comments.push(comment);
    }
    return comments;
  }

  async convertLinkCommentToLink(comment: LinkComment): Promise<CommentLink> {
    const file = this.getFile(comment.fileId);
    return {
      linkToCommentId: comment.id,
      text: `${file.name}, page ${
        getHighestZeroIndexedPageNumber(comment.highlightArea.boundingBoxes) + 1
      }`,
      likeToFileId: file.id,
    };
  }

  async convertLinkCommentToComment(
    comment: LinkComment,
    parentComment: ClaimComment,
    parentFile: WorkspaceFile,
    group: CommentGroup
  ): Promise<Comment> {
    return {
      id: comment.id,
      fileId: comment.fileId,
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
          text: `${parentFile.name}, page ${
            getHighestZeroIndexedPageNumber(
              parentComment.highlightArea.boundingBoxes
            ) + 1
          }`,
          likeToFileId: parentFile.id,
        },
      ],
    };
  }
}

export async function convertChatSourceCommentToComments(
  chatSourceComment: ChatSourceComment,
  group: CommentGroup
): Promise<Comment[]> {
  const comment: Comment = {
    id: chatSourceComment.id,
    fileId: chatSourceComment.fileId,
    groupId: group.id,
    body: chatSourceComment.text || "Source from AI Assistant",
    author: "Harlus",
    timestamp: new Date(),
    annotations: convertHighlightAreaToAnnotations(
      chatSourceComment.highlightArea
    ),
    links: [],
    tag: CommentTag.SOURCE,
  };

  return [comment];
}

function convertHighlightAreaToAnnotations(
  highlightArea: HighlightArea
): ReactPdfHighlightArea[] {
  return highlightArea.boundingBoxes.map((boundingBox) => ({
    pageIndex: boundingBox.page,
    ...boundingBox,
  }));
}
