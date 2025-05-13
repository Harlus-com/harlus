import os
import json
import asyncio
from typing import Dict, Optional, Any

from pydantic import BaseModel, ConfigDict, Field
from src.util import Timestamp, snake_to_camel
from src.file_store import FileStore, Workspace

JsonType = Dict[str, Any]


class CommentGroup(BaseModel):
    id: str
    name: str
    created_at: Timestamp = Field(alias="createdAt")

    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=snake_to_camel,
        from_attributes=True,
        frozen=True,
    )


class CommentStore:
    def __init__(self, file_store: FileStore):
        self.file_store = file_store
        self.lock = asyncio.Lock()

        for workspace in self.file_store.get_workspaces().values():
            add_workspace(workspace)

    def add_workspace(self, workspace):
        add_workspace(workspace)

    def get_comment_group_ids(self, workspace_id: str) -> list[str]:
        groups_file = self._get_comments_file_path(workspace_id, "comment_groups.json")
        with open(groups_file, "r") as f:
            groups = json.load(f)
        return list(groups.keys())

    def group_exists(self, workspace_id: str, group_id: str) -> bool:
        return group_id in self.get_comment_group_ids(workspace_id)

    def create_comment_group(self, workspace_id: str, comment_group: CommentGroup):
        """Create a new comment group and save it to comment_groups.json"""
        groups_file = self._get_comments_file_path(workspace_id, "comment_groups.json")
        with open(groups_file, "r") as f:
            groups = json.load(f)
        groups[comment_group.id] = comment_group.model_dump()
        with open(groups_file, "w") as f:
            json.dump(groups, f, indent=2)

    def delete_comment_group(self, workspace_id: str, group_id: str):
        """Delete the comment group from comment_groups.json and its comments from disk"""
        groups_file = self._get_comments_file_path(workspace_id, "comment_groups.json")
        with open(groups_file, "r") as f:
            groups = json.load(f)
        if group_id in groups:
            del groups[group_id]
            with open(groups_file, "w") as f:
                json.dump(groups, f, indent=2)

        comments_dir = self._get_comments_dir(workspace_id)
        for file_name in os.listdir(comments_dir):
            if file_name.endswith("_comment.json"):
                file_path = self._get_comments_file_path(workspace_id, file_name)
                comment = json.load(open(file_path))
                if comment["apiData"]["groupId"] == group_id:
                    os.remove(file_path)

    def rename_comment_group(self, workspace_id: str, group_id: str, name: str):
        """Rename a comment group in comment_groups.json"""
        groups_file = self._get_comments_file_path(workspace_id, "comment_groups.json")
        with open(groups_file, "r") as f:
            groups = json.load(f)
        if not group_id in groups:
            raise ValueError(f"Comment group {group_id} not found")
        groups[group_id]["name"] = name
        with open(groups_file, "w") as f:
            json.dump(groups, f, indent=2)

    def get_comment_groups(self, workspace_id: str) -> list[CommentGroup]:
        """Get all comment groups for a workspace"""
        groups_file = self._get_comments_file_path(workspace_id, "comment_groups.json")
        with open(groups_file, "r") as f:
            groups = json.load(f)
        return [CommentGroup.model_validate(group) for group in groups.values()]

    def get_comment_group(
        self, workspace_id: str, group_id: str
    ) -> Optional[CommentGroup]:
        """Get comment group information from comment_groups.json"""
        groups_file = self._get_comments_file_path(workspace_id, "comment_groups.json")
        with open(groups_file, "r") as f:
            groups = json.load(f)
        if group_id not in groups:
            return None
        group = groups[group_id]
        return CommentGroup.model_validate(group)

    async def save_comments(self, workspace_id: str, comments: list[JsonType]):
        """Add a save request to the queue. The actual save will happen after debounce."""
        async with self.lock:
            os.makedirs(self._get_comments_dir(workspace_id), exist_ok=True)
            for comment in comments:
                print("Saving comment", comment)
                file_path = self._get_comments_file_path(
                    workspace_id, f"{comment['apiData']['id']}_comment.json"
                )
                with open(file_path, "w") as f:
                    json.dump(comment, f, indent=2)

    def get_comments(self, workspace_id) -> list[JsonType]:
        """Read comments from disk."""
        comments = []
        for file_name in os.listdir(self._get_comments_dir(workspace_id)):
            file_path = self._get_comments_file_path(workspace_id, file_name)
            if file_path.endswith("_comment.json"):
                with open(file_path, "r") as f:
                    comments.append(json.load(f))
        return comments

    def _get_comments_dir(self, workspace_id: str) -> str:
        workspace = self.file_store.get_workspaces()[workspace_id]
        return os.path.join(workspace.absolute_path, "comments")

    def _get_comments_file_path(self, workspace_id: str, file_name: str) -> str:
        return os.path.join(self._get_comments_dir(workspace_id), file_name)


def add_workspace(workspace: Workspace):
    comments_dir = os.path.join(workspace.absolute_path, "comments")
    if not os.path.exists(comments_dir):
        os.makedirs(comments_dir)
    groups_file = os.path.join(comments_dir, "comment_groups.json")
    if not os.path.exists(groups_file):
        with open(groups_file, "w") as f:
            json.dump({}, f, indent=2)
