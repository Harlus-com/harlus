import os
import shutil
import json
import sys


def reset_directory(dir_path: str):
    # Ensure directory exists
    os.makedirs(dir_path, exist_ok=True)

    # Clear contents
    for item in os.listdir(dir_path):
        full_path = os.path.join(dir_path, item)
        if os.path.isfile(full_path) or os.path.islink(full_path):
            os.unlink(full_path)
        elif os.path.isdir(full_path):
            shutil.rmtree(full_path)

    # Create files with content []
    for filename in ("files.json", "folders.json"):
        with open(os.path.join(dir_path, filename), "w") as f:
            json.dump([], f)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python reset_workspace.py <directory_path>")
        sys.exit(1)

    directory = sys.argv[1]
    reset_directory(directory)
    print(f"Workspace reset at: {directory}")
