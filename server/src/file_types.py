from pydantic import BaseModel, Field, ConfigDict
from src.util import snake_to_camel
import os


class LocalFile(BaseModel):
    """
    Representation of a file on the users local file system.
    """

    content_hash: str = Field(alias="contentHash")
    name: str
    path_relative_to_workspace: list[str] = Field(alias="pathRelativeToWorkspace")


class File(BaseModel):
    id: str
    name: str
    absolute_path: str = Field(alias="absolutePath")
    workspace_id: str = Field(alias="workspaceId")

    def working_dir(self) -> str:
        return os.path.dirname(self.absolute_path)

    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=snake_to_camel,
        from_attributes=True,
        frozen=True,
    )
