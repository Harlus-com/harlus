import json
import os
import shutil
from src.util import normalize_underscores
from src.file_types import LocalFile, File
from src.workspace_store import WorkspaceStore


class FileStore:
    def __init__(self, workspace_store: WorkspaceStore):
        self.workspace_store = workspace_store

    def initialize(self):
        for workspace in self.workspace_store.get_workspaces().values():
            if not os.path.exists(workspace.relative_path("files.json")):
                with open(workspace.relative_path("files.json"), "w") as f:
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
        for workspace in self.workspace_store.get_workspaces().values():
            files_by_path = {
                f.absolute_path: f for f in self.get_files(workspace.id).values()
            }
            file = files_by_path.get(path)
            if file is not None:
                return file
        raise ValueError(f"File with path {path} not found")

    def get_all_files(self) -> list[File]:
        files = []
        for workspace in self.workspace_store.get_workspaces().values():
            files.extend(self.get_files(workspace.id).values())
        return files

    def get_files(self, workspace_id: str) -> dict[str, File]:
        workspace = self.workspace_store.get_workspaces()[workspace_id]
        with open(workspace.relative_path("files.json"), "r") as f:
            return {
                file.id: file
                for file in [File.model_validate(file) for file in json.load(f)]
            }

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
        workspace = self.workspace_store.get_workspaces()[workspace_id]
        file_dir_name = _get_file_dir_name(
            content_hash, path_relative_to_workspace, file_name
        )
        absolute_path = str(
            workspace.relative_path(
                os.path.join(
                    file_dir_name,
                    # TODO: DO NOT HARDCODE PDF!!!
                    "content.pdf",
                )
            )
        )
        file = File(
            id=content_hash,
            name=file_name,
            absolute_path=absolute_path,
            workspace_id=workspace_id,
        )
        print("Adding file", file)
        workspace = self.workspace_store.get_workspaces()[file.workspace_id]
        current_files = self.get_files(file.workspace_id).values()
        new_files = [file.model_dump() for file in current_files] + [file.model_dump()]
        with open(workspace.relative_path("files.json"), "w") as f:
            json.dump(new_files, f, indent=2)
        return file

    def delete_file(self, file_id: str, workspace_id: str):
        print("Deleting file", file_id)
        file = self.get_files(workspace_id).get(file_id)
        if file is None:
            return None
        workspace = self.workspace_store.get_workspaces()[file.workspace_id]
        file_path = workspace.relative_path("files.json")
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
        for workspace in self.workspace_store.get_workspaces().values():
            files.extend(self.get_files(workspace.id).values())
        for file in files:
            if file.id == file_id:
                return file
        return None

    def update_server_directories(self, workspace_id: str, files: list[LocalFile]):
        workspace = self.workspace_store.get_workspaces()[workspace_id]
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
            incoming_working_dir = str(workspace.relative_path(incoming_file_dir_name))

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
            with open(workspace.relative_path("files.json"), "w") as f:
                json.dump([file.model_dump() for file in new_files], f, indent=2)


def _get_file_dir_name(content_hash: str, app_dir: list[str], file_name: str) -> str:
    path_prefix = normalize_underscores("_".join(app_dir))
    if not path_prefix:
        return f"{file_name}__{content_hash[:5]}"
    else:
        return f"{path_prefix}__{file_name}__{content_hash[:5]}"
