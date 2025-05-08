import { client } from "@/api/client";
import { CommentGroup } from "@/api/comment_types";
import { CommentComponentData } from "./comment_ui_types";

export class CommentService {
  async createCommentGroup(
    workspaceId: string,
    commentGroup: CommentGroup
  ): Promise<CommentGroup> {
    return client.post("/comments/group/create", {
      commentGroup,
      workspaceId,
    });
  }

  async createIfNotExists(
    workspaceId: string,
    commentGroup: CommentGroup
  ): Promise<void> {
    const existingGroup = await this.getCommentGroup(
      workspaceId,
      commentGroup.id
    );
    if (existingGroup) {
      return;
    }
    await this.createCommentGroup(workspaceId, commentGroup);
  }

  /**
   * Saves comments to the server.
   *
   * Comments that have already been saved (i.e have the same id) will be ignored.
   */
  async saveComments(
    workspaceId: string,
    comments: CommentComponentData[]
  ): Promise<void> {
    await client.post("/comments/save", { comments, workspaceId });
  }

  async getCommentGroup(
    workspaceId: string,
    commentGroupId: string
  ): Promise<CommentGroup> {
    return client.get(
      `/comments/group/get?workspaceId=${workspaceId}&groupId=${commentGroupId}`
    );
  }
  async getAllCommentGroups(workspaceId: string): Promise<CommentGroup[]> {
    return client.get(`/comments/group/all?workspaceId=${workspaceId}`);
  }

  async getAllSavedComments(
    workspaceId: string
  ): Promise<CommentComponentData[]> {
    return client.get(`/comments/saved?workspaceId=${workspaceId}`);
  }

  async renameCommentGroup(
    workspaceId: string,
    commentGroupId: string,
    name: string
  ): Promise<void> {
    await client.post(`/comments/group/rename`, {
      workspaceId,
      commentGroupId,
      name,
    });
  }

  async deleteCommentGroup(
    workspaceId: string,
    commentGroupId: string
  ): Promise<void> {
    await client.post(`/comments/group/delete`, {
      workspaceId,
      commentGroupId,
    });
  }
}

export const commentService = new CommentService();
