import json
import os
from pathlib import Path
import shutil
import tempfile
from typing import Tuple, Union, Iterator
import uuid
from pydantic import BaseModel, ConfigDict, Field
from src.util import get_content_hash, normalize_underscores, snake_to_camel, clean_name

# from src.sec_loader import SecSourceLoader, WebFile


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


"""
Representation of a file on the users local file system.
"""


class LocalFile(BaseModel):
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


class FileStore:
    def __init__(self, app_data_path: Path):
        print("Initializing FileStore with app_data_path", app_data_path)
        self.app_data_path = app_data_path
        os.makedirs(app_data_path, exist_ok=True)
        if not os.path.exists(app_data_path.joinpath("workspaces.json")):
            with open(app_data_path.joinpath("workspaces.json"), "w") as f:
                json.dump([], f, indent=2)
        else:
            with open(app_data_path.joinpath("workspaces.json"), "r") as f:
                workspaces = json.load(f)
                for workspace in workspaces:
                    workspace_path = app_data_path.joinpath(workspace["dir_name"])
                    os.makedirs(workspace_path, exist_ok=True)
                    if not os.path.exists(workspace_path.joinpath("files.json")):
                        with open(workspace_path.joinpath("files.json"), "w") as f:
                            json.dump([], f, indent=2)

    def get_file(self, file_id: str, workspace_id: str | None = None) -> File:
        if workspace_id is not None:
            return self.get_files(workspace_id)[file_id]
        file = self.find_file(file_id)
        if file is None:
            raise ValueError(f"File with id {file_id} not found")
        return file

    def get_file_by_path(self, path: str, workspace_id: str | None = None) -> File:
        if workspace_id is not None:
            files_by_path = {
                f.absolute_path: f for f in self.get_files(workspace_id).values()
            }
            return files_by_path[path]
        for workspace in self.get_workspaces().values():
            files_by_path = {
                f.absolute_path: f for f in self.get_files(workspace.id).values()
            }
            file = files_by_path.get(path)
            if file is not None:
                return file
        raise ValueError(f"File with path {path} not found")

    def get_all_files(self) -> list[File]:
        files = []
        for workspace in self.get_workspaces().values():
            files.extend(self.get_files(workspace.id).values())
        return files

    def get_files(self, workspace_id: str) -> dict[str, File]:
        workspace = self.get_workspaces()[workspace_id]
        with open(
            self.app_data_path.joinpath(workspace.dir_name, "files.json"), "r"
        ) as f:
            return {
                file.id: file
                for file in [File.model_validate(file) for file in json.load(f)]
            }

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
        self._add_workspace(workspace)
        return workspace

    def _add_workspace(self, workspace: Workspace):
        current_workspaces = self.get_workspaces().values()
        new_workspaces = [
            workspace.model_dump() for workspace in current_workspaces
        ] + [workspace.model_dump()]
        print("Adding workspace", new_workspaces)
        with open(self.app_data_path.joinpath("workspaces.json"), "w") as f:
            json.dump(new_workspaces, f, indent=2)

    # TODO: Delete this method
    def copy_file_to_workspace(
        self, path: str, workspace_id: str, app_dir: list[str] = []
    ) -> File:
        print("Copying file to workspace", path, workspace_id, app_dir)
        workspace = self.get_workspaces()[workspace_id]
        content_hash = get_content_hash(path)
        file_name = normalize_underscores(clean_name(os.path.basename(path)))
        file_dir_name = _get_file_dir_name(content_hash, app_dir, file_name)
        absolute_path = str(
            self.app_data_path.joinpath(
                workspace.dir_name,
                file_dir_name,
                # TODO: DO NOT HARDCODE PDF!!!
                "content.pdf",
            )
        )
        file = File(
            id=content_hash,
            name=file_name,
            absolute_path=absolute_path,
            workspace_id=workspace_id,
        )
        os.makedirs(os.path.dirname(absolute_path), exist_ok=False)
        shutil.copy(path, absolute_path)
        self._add_file(file)
        return file

    def is_fully_uploaded(self, file_id: str) -> bool:
        file = self.find_file(file_id)
        if file is None:
            return False
        return os.path.exists(file.absolute_path)

    def copy_file_content(self, file: File, path: str):
        os.makedirs(os.path.dirname(file.absolute_path), exist_ok=False)
        shutil.copy(path, file.absolute_path)

    def create_file(
        self,
        workspace_id: str,
        path_relative_to_workspace: list[str],
        content_hash: str,
        file_name: str,
    ) -> File:
        workspace = self.get_workspaces()[workspace_id]
        file_dir_name = _get_file_dir_name(
            content_hash, path_relative_to_workspace, file_name
        )
        absolute_path = str(
            self.app_data_path.joinpath(
                workspace.dir_name,
                file_dir_name,
                # TODO: DO NOT HARDCODE PDF!!!
                "content.pdf",
            )
        )
        file = File(
            id=content_hash,
            name=file_name,
            absolute_path=absolute_path,
            workspace_id=workspace_id,
        )
        self._add_file(file)
        return file

    def _add_file(self, file: File):
        print("Adding file", file)
        workspace = self.get_workspaces()[file.workspace_id]
        current_files = self.get_files(file.workspace_id).values()
        new_files = [file.model_dump() for file in current_files] + [file.model_dump()]
        with open(
            self.app_data_path.joinpath(workspace.dir_name, "files.json"), "w"
        ) as f:
            json.dump(new_files, f, indent=2)

    def delete_file(self, file_id: str, workspace_id: str):
        print("Deleting file", file_id)
        file = self.get_files(workspace_id).get(file_id)
        if file is None:
            return None
        workspace = self.get_workspaces()[file.workspace_id]
        file_path = self.app_data_path.joinpath(workspace.dir_name, "files.json")
        with open(file_path, "r") as f:
            files = [File.model_validate(file) for file in json.load(f)]
        new_files = [file for file in files if file.id != file_id]
        with open(file_path, "w") as f:
            json.dump([file.model_dump() for file in new_files], f, indent=2)

        print("Deleting file", file.absolute_path)
        shutil.rmtree(os.path.dirname(file.absolute_path))
        return file

    def find_file(self, file_id: str) -> File | None:
        files = []
        for workspace in self.get_workspaces().values():
            files.extend(self.get_files(workspace.id).values())
        for file in files:
            if file.id == file_id:
                return file
        return None

    def _open(
        self,
        workspace_or_workspace_id: Union[Workspace, str],
        file_path: str,
        mode: str,
    ) -> File:
        workspace = (
            self.get_workspaces()[workspace_or_workspace_id]
            if isinstance(workspace_or_workspace_id, str)
            else workspace_or_workspace_id
        )
        return open(self.app_data_path.joinpath(workspace.dir_name, file_path), mode)

    def get_file_path_to_id(self, workspace_id: str) -> dict[str, str]:
        workspace = self.get_workspaces()[workspace_id]
        with open(
            self.app_data_path.joinpath(workspace.dir_name, "files.json"), "r"
        ) as f:
            files = [File.model_validate(file) for file in json.load(f)]
        return {file.absolute_path: file.id for file in files}

    def _get_all_file_children(
        self, workspace_id: str, app_dir: list[str]
    ) -> list[File]:
        return []

    def _change_file_path_prefix(
        self, file: File, old_prefix: list[str], new_prefix: list[str]
    ) -> None:
        pass

def update_server_directories(self, workspace_id: str, files: list[LocalFile]):
        workspace = self.get_workspaces()[workspace_id]
        files_by_id = self.get_files(workspace_id)
        file_path_updates: dict[str, str] = {}
        for file in files:
            if not file.content_hash in files_by_id:
                continue
            current_file = files_by_id[file.content_hash]
            current_working_dir = current_file.working_dir()
            incoming_file_dir_name = _get_file_dir_name(
                file.content_hash, file.path_relative_to_workspace, file.name
            )
            incoming_working_dir = str(
                self.app_data_path.joinpath(workspace.dir_name, incoming_file_dir_name)
            )

            if current_working_dir != incoming_working_dir:
                print(f"Moving {current_working_dir} to {incoming_working_dir}")
                shutil.move(
                    current_working_dir,
                    incoming_working_dir,
                )
                file_path_updates[file.content_hash] = os.path.join(
                    incoming_working_dir, "content.pdf"
                )
        if len(file_path_updates) > 0:
            new_files = []
            for file_id, file in files_by_id.items():
                if file_id in file_path_updates:
                    new_files.append(
                        File(
                            id=file_id,
                            name=file.name,
                            absolute_path=file_path_updates[file_id],
                            workspace_id=workspace_id,
                        )
                    )
                else:
                    new_files.append(file)
            with self._open(workspace_id, "files.json", "w") as f:
                json.dump([file.model_dump() for file in new_files], f, indent=2)


def _get_file_dir_name(content_hash: str, app_dir: list[str], file_name: str) -> str:
    path_prefix = normalize_underscores("_".join(app_dir))
    if not path_prefix:
        return f"{file_name}__{content_hash[:5]}"
    else:
        return f"{path_prefix}__{file_name}__{content_hash[:5]}"
