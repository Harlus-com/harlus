from collections import defaultdict
import shutil
import subprocess
import os
import sys
import json
from typing import Tuple
from packaging.utils import parse_wheel_filename
import argparse


def package_tool(tool_name):
    print(f"Packaging {tool_name}...")
    tool_dir = os.path.abspath(f"../../ml/tools/{tool_name}")
    tool_name = f"harlus_{tool_name}"
    subprocess.run(["python", "-m", "build"], cwd=tool_dir)
    print(f"Packaged {tool_name}")

    dist_wheels = defaultdict(list[Tuple[str, str]])
    for file in os.listdir(os.path.join(tool_dir, "dist")):
        if not file.endswith(".whl"):
            continue
        name, version, *_ = parse_wheel_filename(file)
        dist_wheels[name.replace("-", "_")].append(
            (version, os.path.join(tool_dir, "dist", file))
        )
    print(f"Found dist wheels: {dist_wheels}")
    if not tool_name in dist_wheels:
        print(f"Tool {tool_name} not found in {tool_dir}/dist")
        raise Exception()
    tool_wheels = dist_wheels[tool_name]
    highest_version_wheel = max(tool_wheels, key=lambda x: x[0])
    wheel_path = highest_version_wheel[1]

    print(f"Copying {tool_name} wheel to wheels directory...")
    wheel_name = os.path.basename(wheel_path)
    for wheel in os.listdir("wheels"):
        if wheel_name == wheel:
            print(f"Removing old wheel: {wheel}")
            os.remove(os.path.join("wheels", wheel))
    print(f"Copying {tool_name} wheel to wheels directory...")
    os.makedirs("wheels", exist_ok=True)
    shutil.copy(wheel_path, os.path.join("wheels", wheel_name))
    print(f"Copied {tool_name} wheel to wheels directory")

    local_wheel_path = os.path.join("wheels", wheel_name)

    print(f"Installing {tool_name}...")
    if get_dep(tool_name) is not None:
        print(f"Uninstalling {tool_name}...")
        subprocess.run(["pip", "uninstall", "-y", tool_name])
    subprocess.run(["pip", "install", local_wheel_path])
    print(f"Installed {tool_name}")

    print("Done!")


def link(tool_name):
    tool_dir_name = tool_name
    tool_name = f"harlus_{tool_name}"
    if get_dep(tool_name) is not None:
        subprocess.run(["pip", "uninstall", "-y", tool_name])
    local_tool_path = os.path.abspath(f"../../ml/tools/{tool_dir_name}")
    subprocess.run(["pip", "install", "-e", local_tool_path])
    print(f"Linked {tool_name} to {local_tool_path}")


def unlink(tool_name):
    tool_dir_name = tool_name
    tool_name = f"harlus_{tool_name}"
    dep = get_dep(tool_name)
    if dep is not None:
        if not "editable_project_location" in dep:
            raise Exception(f"Tool {tool_name} is not linked")
    subprocess.run(["pip", "uninstall", "-y", tool_name])
    local_wheels = defaultdict(list[Tuple[str, str]])
    for file in os.listdir("wheels"):
        if tool_name in file:
            name, version, *_ = parse_wheel_filename(file)
            local_wheels[name.replace("-", "_")].append(
                (version, os.path.join("wheels", file))
            )
    print(f"Found local wheels: {local_wheels}")
    if not tool_name in local_wheels:
        raise Exception(f"Tool {tool_name} not found in wheels directory")
    tool_wheels = local_wheels[tool_name]
    highest_version_wheel = max(tool_wheels, key=lambda x: x[0])
    print(f"Unlinked {tool_name} from {f'../../ml/tools/{tool_dir_name}'}")
    subprocess.run(["pip", "install", highest_version_wheel[1]])
    print(f"Installed {highest_version_wheel[1]}")


def get_dep(name):
    deps = list_deps_json()
    for dep in deps:
        if dep["name"] == name:
            return dep
    return None


def list_deps_json():
    proc = subprocess.run(
        [sys.executable, "-m", "pip", "list", "--format=json"],
        capture_output=True,
        text=True,
        check=True,
    )
    return json.loads(proc.stdout)


if __name__ == "__main__":
    p = argparse.ArgumentParser(
        description="package.py: --package, --link or --unlink a tool"
    )
    p.add_argument(
        "--tool-name",
        help="name of your tool directory",
        default=None,
        required=False,
    )
    grp = p.add_mutually_exclusive_group(required=True)
    grp.add_argument("--package", action="store_true", help="build & install wheel")
    grp.add_argument("--link", action="store_true", help="pip install -e")
    grp.add_argument(
        "--unlink", action="store_true", help="uninstall editable & reinstall wheel"
    )
    args = p.parse_args()

    if args.package:
        if args.tool_name:
            package_tool(args.tool_name)
        else:
            for tool in os.listdir("../../ml/tools"):
                package_tool(tool)
    elif args.link:
        if args.tool_name:
            link(args.tool_name)
        else:
            for tool in os.listdir("../../ml/tools"):
                link(tool)
    elif args.unlink:
        if args.tool_name:
            unlink(args.tool_name)
        else:
            for tool in os.listdir("../../ml/tools"):
                unlink(tool)
    else:
        raise Exception("Invalid argument")
