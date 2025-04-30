from pydantic import BaseModel, ConfigDict
import os


class FlatFolderHierarchy(BaseModel):
    """
    Flat folder hierarchy
    """

    """max depth of the deepest folder/file leaf"""
    max_depth: int
    """root folder name"""
    root_folder: str
    """relative path of folders"""
    folders: list[str]
    """relative path of file to relative path of folder"""
    file_to_folder: dict[str, str]
    """relative path of folder to absolute path of folder"""
    folder_to_absolute_path: dict[str, str]
    """relative path of file to absolute path of file"""
    file_to_absolute_path: dict[str, str]

    model_config = ConfigDict(frozen=True)


def get_flat_folder_hierarchy(root_folder_path: str) -> FlatFolderHierarchy:
    root_folder_path = os.path.abspath(root_folder_path)
    folders = []
    file_to_folder_map = {}
    max_depth = 0

    for dirpath, _, filenames in os.walk(root_folder_path):
        folders.append(dirpath)
        path_relative_to_root = os.path.relpath(dirpath, root_folder_path)
        current_depth = (
            path_relative_to_root.count(os.sep) + 1
        )  # +1 for the root folder
        max_depth = max(max_depth, current_depth)

        for file in filenames:
            file_path = os.path.join(dirpath, file)
            file_to_folder_map[file_path] = dirpath

    prefix = os.path.dirname(root_folder_path)

    return FlatFolderHierarchy(
        max_depth=max_depth,
        root_folder=os.path.basename(root_folder_path),
        folders=sorted([os.path.relpath(f, prefix) for f in folders]),
        file_to_folder=dict(
            sorted(
                [
                    (os.path.relpath(file, prefix), os.path.relpath(folder, prefix))
                    for file, folder in file_to_folder_map.items()
                ]
            )
        ),
        folder_to_absolute_path=dict(
            sorted([(os.path.relpath(f, prefix), f) for f in folders])
        ),
        file_to_absolute_path=dict(
            sorted([(os.path.relpath(f, prefix), f) for f in file_to_folder_map.keys()])
        ),
    )
