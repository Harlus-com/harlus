from pydantic import BaseModel, Field, ConfigDict
from src.util import snake_to_camel, clean_name
import os
import json
from pathlib import Path
import uuid
import shutil


class Workspace(BaseModel):
    id: str
    name: str
    local_dir: str = Field(alias="localDir")
    dir_name: str = Field(alias="dirName")
    absolute_path: str = Field(alias="absolutePath")

    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=snake_to_camel,
        from_attributes=True,
        frozen=True,
    )

    def relative_path(self, path: str) -> Path:
        return os.path.join(self.absolute_path, path)


class WorkspaceStore:

    def __init__(self, app_data_path: Path):
        self.app_data_path = app_data_path

    def initialize(self):
        os.makedirs(self.app_data_path, exist_ok=True)
        if not os.path.exists(self.app_data_path.joinpath("workspaces.json")):
            with open(self.app_data_path.joinpath("workspaces.json"), "w") as f:
                json.dump([], f, indent=2)
        for workspace in self.get_workspaces().values():
            os.makedirs(workspace.absolute_path, exist_ok=True)

    def get_workspaces(self) -> dict[str, Workspace]:
        with open(self.app_data_path.joinpath("workspaces.json"), "r") as f:
            return {
                workspace.id: workspace
                for workspace in [
                    Workspace.model_validate(workspace) for workspace in json.load(f)
                ]
            }

    def delete_workspace(self, workspace_id) -> bool:
        workspaces = self.get_workspaces()
        workspace = workspaces[workspace_id]
        workspace_path = Path(workspace.absolute_path)
        if workspace_path.exists():
            shutil.rmtree(workspace_path)
        updated_workspaces = [w for w in workspaces.values() if w.id != workspace_id]
        with open(self.app_data_path.joinpath("workspaces.json"), "w") as f:
            json.dump([w.model_dump() for w in updated_workspaces], f, indent=2)
        return True

    def create_workspace(self, name: str, local_dir: str) -> Workspace:
        workspaces = self.get_workspaces().values()
        for workspace in workspaces:
            if workspace.name == name:
                raise ValueError(f"Workspace with name {name} already exists")
        dir_name = clean_name(name)
        print("Creating workspace with dir_name", dir_name)
        for workspace in workspaces:
            if workspace.dir_name == dir_name:
                raise ValueError(
                    f"Workspace directory name is the same as {workspace.name}"
                )
        workspace = Workspace(
            id=str(uuid.uuid4()),
            name=name,
            dir_name=dir_name,
            absolute_path=str(self.app_data_path.joinpath(dir_name)),
            local_dir=local_dir,
        )
        os.makedirs(self.app_data_path.joinpath(workspace.dir_name), exist_ok=True)
        with open(
            self.app_data_path.joinpath(workspace.dir_name, "files.json"), "w"
        ) as f:
            json.dump([], f, indent=2)
        current_workspaces = self.get_workspaces().values()
        new_workspaces = [
            workspace.model_dump() for workspace in current_workspaces
        ] + [workspace.model_dump()]
        print("Adding workspace", new_workspaces)
        with open(self.app_data_path.joinpath("workspaces.json"), "w") as f:
            json.dump(new_workspaces, f, indent=2)
