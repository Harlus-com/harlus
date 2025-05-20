import json
import os
from pathlib import Path
import shutil
import tempfile
from typing import Union, Iterator
import uuid
from pydantic import BaseModel, ConfigDict, Field
from src.file_util import get_flat_folder_hierarchy
from src.util import snake_to_camel, clean_name

from src.sec_loader import SecSourceLoader, WebFileData


class Workspace(BaseModel):
    id: str
    name: str
    dir_name: str = Field(alias="dirName")
    absolute_path: str = Field(alias="absolutePath")

    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=snake_to_camel,
        from_attributes=True,
        frozen=True,
    )


class File(BaseModel):
    id: str
    name: str
    absolute_path: str = Field(alias="absolutePath")
    workspace_id: str = Field(alias="workspaceId")
    app_dir: list[str] = Field(default=[], alias="appDir")

    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=snake_to_camel,
        from_attributes=True,
        frozen=True,
    )


class Folder(BaseModel):
    """Folder in the workspace"""

    """
    Has duel purpose as key and as a folder name in the workspace
    For example, if the folder is "reports/earnings", the app_dir is ["reports", "earnings"]
    """
    app_dir: list[str] = Field(default=[], alias="appDir")
    """Convenience field for the folder name in the workspace (will allways be the last element of the app_dir)"""
    name: str
    workspace_id: str

    model_config = ConfigDict(frozen=True, populate_by_name=True)


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
                    if not os.path.exists(workspace_path.joinpath("folders.json")):
                        with open(workspace_path.joinpath("folders.json"), "w") as f:
                            json.dump([], f, indent=2)

    def get_file(self, file_id: str, workspace_id: str | None = None) -> File:
        if workspace_id is not None:
            return self.get_files(workspace_id)[file_id]
        file = self._find_file(file_id)
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

    def get_folders(self, workspace_id: str) -> list[Folder]:
        workspace = self.get_workspaces()[workspace_id]
        with self._open(workspace, "folders.json", "r") as f:
            return [Folder.model_validate(folder) for folder in json.load(f)]

    def create_workspace(self, name: str) -> Workspace:
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
        )
        os.makedirs(self.app_data_path.joinpath(workspace.dir_name), exist_ok=True)
        with open(
            self.app_data_path.joinpath(workspace.dir_name, "files.json"), "w"
        ) as f:
            json.dump([], f, indent=2)
        with open(
            self.app_data_path.joinpath(workspace.dir_name, "folders.json"), "w"
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

    def copy_file_to_workspace(
        self, path: str, workspace_id: str, app_dir: list[str] = []
    ) -> File:
        print("Copying file to workspace", path, workspace_id, app_dir)
        if len(app_dir) != 0 and not self._folder_exists(app_dir, workspace_id):
            raise ValueError(f"Folder {app_dir} does not exist")

        workspace = self.get_workspaces()[workspace_id]
        original_file_name = os.path.basename(path)
        workspace_files = self.get_files(workspace_id).values()
        existing_file_names = [f.name for f in workspace_files]
        i = 1
        file_name = original_file_name
        while file_name in existing_file_names:
            file_name = f"{original_file_name} ({i})"
            i += 1
            if i > 100:
                raise ValueError(f"File name {file_name} already exists")
        # TODO: This is technically a bug because we could end up with a file_dir_name that is not unique
        file_dir_name = clean_name(file_name)
        existing_file_dir_names = [clean_name(f.name) for f in workspace_files]
        if file_dir_name in existing_file_dir_names:
            raise ValueError(f"File directory name {file_dir_name} already exists")
        id = str(uuid.uuid4())
        absolute_path = str(
            self.app_data_path.joinpath(
                # TODO: DO NOT HARDCODE PDF!!!
                workspace.dir_name,
                file_dir_name,
                "content.pdf",
            )
        )
        file = File(
            id=id,
            name=file_name,
            absolute_path=absolute_path,
            workspace_id=workspace_id,
            app_dir=app_dir,
        )
        os.makedirs(os.path.dirname(absolute_path), exist_ok=True)  # CHANGE TO FALSE
        shutil.copy(path, absolute_path)
        self._add_file(file)
        return file


    def add_folder(self, app_dir: list[str], workspace_id: str):
        if len(app_dir) == 0:
            raise ValueError("App dir cannot be empty")
        folder = Folder(
            app_dir=app_dir,
            name=app_dir[-1],
            workspace_id=workspace_id,
        )
        workspace = self.get_workspaces()[workspace_id]
        current_folders = self.get_folders(workspace_id)
        if folder in current_folders:
            return
        new_folders = [folder.model_dump() for folder in current_folders] + [
            folder.model_dump()
        ]
        with self._open(workspace, "folders.json", "w") as f:
            json.dump(new_folders, f, indent=2)

    def _add_file(self, file: File):
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

    def _find_file(self, file_id: str) -> File | None:
        files = []
        for workspace in self.get_workspaces().values():
            files.extend(self.get_files(workspace.id).values())
        for file in files:
            if file.id == file_id:
                return file
        return None

    def copy_folder_to_workspace(self, path: str, workspace_id: str) -> Folder:
        flat_folder_hierarchy = get_flat_folder_hierarchy(path)
        if flat_folder_hierarchy.max_depth > 10:
            raise ValueError(
                f"Folder {path} is too deep, max depth is 10, current depth is {flat_folder_hierarchy.max_depth}"
            )
        folder_count = len(flat_folder_hierarchy.folders)
        file_count = len(flat_folder_hierarchy.file_to_folder)
        if file_count > 10000:
            raise ValueError(
                f"Folder {path} has too many files, max is 10,000, current is {file_count}"
            )
        if folder_count > 1000:
            raise ValueError(
                f"Folder {path} has too many folders, max is 1,000, current is {folder_count}"
            )
        for folder in flat_folder_hierarchy.folders:
            app_dir = folder.split(os.sep)
            self.add_folder(app_dir, workspace_id)
        for file, folder in flat_folder_hierarchy.file_to_folder.items():
            file_path = flat_folder_hierarchy.file_to_absolute_path[file]
            app_dir = folder.split(os.sep)
            self._copy_file_to_workspace_internal(file_path, workspace_id, app_dir)

    def _folder_exists(self, app_dir: list[str], workspace_id: str) -> bool:
        matching_folder = [
            f for f in self.get_folders(workspace_id) if f.app_dir == app_dir
        ]
        return len(matching_folder) > 0

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

    def delete_folder(self, workspace_id: str, app_dir: list[str]) -> bool:
        all_file_children = self._get_all_file_children(workspace_id, app_dir)
        all_folder_children = self._get_all_folder_children(workspace_id, app_dir)
        for file in all_file_children:
            self.delete_file(file.id, workspace_id)
        for folder in all_folder_children:
            self._delete_folder_internal(workspace_id, folder.app_dir)

    def _delete_folder_internal(self, workspace_id: str, app_dir: list[str]) -> bool:
        folders = self.get_folders(workspace_id)
        new_folders = [
            folder for folder in folders if not _is_equal_path(folder.app_dir, app_dir)
        ]
        with self._open(workspace_id, "folders.json", "w") as f:
            json.dump([folder.model_dump() for folder in new_folders], f, indent=2)

    def _get_all_file_children(
        self, workspace_id: str, app_dir: list[str]
    ) -> list[File]:
        files = self.get_files(workspace_id).values()
        return [file for file in files if _is_sub_path(file.app_dir, app_dir)]

    def _get_all_folder_children(
        self, workspace_id: str, app_dir: list[str]
    ) -> list[Folder]:
        folders = self.get_folders(workspace_id)
        return [folder for folder in folders if _is_sub_path(folder.app_dir, app_dir)]

    def move_folder(
        self, workspace_id: str, app_dir: list[str], new_parent_dir: list[str]
    ) -> bool:
        all_file_children = self._get_all_file_children(workspace_id, app_dir)
        all_folder_children = self._get_all_folder_children(workspace_id, app_dir)
        for file in all_file_children:
            self._change_file_path_prefix(file, app_dir, new_parent_dir)
        for folder in all_folder_children:
            self._change_folder_path_prefix(folder, app_dir, new_parent_dir)

    def _change_file_path_prefix(
        self, file: File, old_prefix: list[str], new_prefix: list[str]
    ) -> None:
        sub_path = _get_sub_path(file.app_dir, old_prefix)
        new_app_dir = [*new_prefix, *sub_path]
        new_file = File(
            id=file.id,
            name=file.name,
            absolute_path=file.absolute_path,
            workspace_id=file.workspace_id,
            app_dir=new_app_dir,
        )
        self._update_file(new_file)

    def _update_file(self, file: File) -> None:
        files = self.get_files(file.workspace_id)
        files[file.id] = file
        with self._open(file.workspace_id, "files.json", "w") as f:
            json.dump([file.model_dump() for file in files.values()], f, indent=2)

    def _change_folder_path_prefix(
        self, folder: Folder, old_prefix: list[str], new_prefix: list[str]
    ) -> None:
        sub_path = _get_sub_path(folder.app_dir, old_prefix)
        new_app_dir = [*new_prefix, *sub_path]
        new_folder = Folder(
            app_dir=new_app_dir,
            name=new_app_dir[-1],
            workspace_id=folder.workspace_id,
        )
        new_folders = self._replace_folder(new_folder, folder.app_dir)
        with self._open(folder.workspace_id, "folders.json", "w") as f:
            json.dump([folder.model_dump() for folder in new_folders], f, indent=2)

    def _replace_folder(self, folder: Folder, old_app_dir: list[str]) -> list[Folder]:
        new_folders = []
        for f in self.get_folders(folder.workspace_id):
            if _is_equal_path(f.app_dir, old_app_dir):
                new_folders.append(folder)
            else:
                new_folders.append(f)
        return new_folders

    def rename_folder(
        self, workspace_id: str, app_dir: list[str], new_name: str
    ) -> bool:
        new_app_dir = [*app_dir[:-1], new_name]
        self.move_folder(workspace_id, app_dir, new_app_dir)

    def move_file(
        self, workspace_id: str, file_id: str, new_parent_dir: list[str]
    ) -> bool:
        file = self.get_file(file_id, workspace_id)
        new_file = File(
            id=file.id,
            name=file.name,
            absolute_path=file.absolute_path,
            workspace_id=workspace_id,
            app_dir=new_parent_dir,
        )
        self._update_file(new_file)


    # TODO: remove the SEC specific naming
    def download_sec_files(self, workspace_id: str) -> list[File]:
        if workspace_id not in self.get_workspaces():
            raise ValueError(f"Workspace with id {workspace_id} not found")
        workspace = self.get_workspaces()[workspace_id]
        ticker = workspace.name # Assuming workspace name is the ticker symbol
        print(f"Fetching SEC files for ticker: {ticker} in workspace: {workspace.name}")

        reports_dir = ["reports"]   # TODO: move to some config file
        self.add_folder(reports_dir, workspace_id)
        
        existing_files = self._get_all_file_children(workspace_id, reports_dir)
        existing_file_names = [f.name for f in existing_files]
        print(f"Found {len(existing_file_names)} existing SEC filing stems in workspace {workspace.name}.")

        sec_loader = SecSourceLoader()
        # TODO: be more robust: check against existing file metada not just file name
        new_file_data_iterator: Iterator[WebFileData] = sec_loader.get_new_files_to_fetch(ticker, existing_file_names)
        print(f"Initiating content fetch for new filings using SecSourceLoader...")

        files_added: list[File] = []
        for file_data in new_file_data_iterator:
            print(f"Processing file data for: {file_data.file_name_no_ext}")
            
            # TODO: make pretty file name for front end
            # TODO: remove hard-coded .pdf extension
            tmp_dir = tempfile.mkdtemp()
            tmp_path = os.path.join(tmp_dir, f"{file_data.file_name_no_ext}.pdf")
            with open(tmp_path, "wb") as out:
                out.write(file_data.pdf_content)

            file = self.copy_file_to_workspace(str(tmp_path), workspace_id, reports_dir)
            files_added.append(file)

        return files_added


def _get_sub_path(path: list[str], prefix: list[str]) -> list[str]:
    if not _is_sub_path(path, prefix):
        raise ValueError(f"Path {path} is not a subpath of {prefix}")
    return path[len(prefix) :]


def _is_equal_path(path: list[str], prefix: list[str]) -> bool:
    if len(path) != len(prefix):
        return False
    for i in range(len(prefix)):
        if path[i] != prefix[i]:
            return False
    return True


def _is_sub_path(path: list[str], prefix: list[str]) -> bool:
    if len(path) < len(prefix):
        return False
    for i in range(len(prefix)):
        if path[i] != prefix[i]:
            return False
    return True
