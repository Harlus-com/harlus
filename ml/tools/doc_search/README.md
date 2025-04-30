## General Overview

The idea is that each tool get's its own package.

The server will then take the _packaged_ tool as a dependnecy. This is **different** than importing the python code directly into the server directory.

(It allows for isolated tool development, and reproducability at fixed versions etc. Other development benefits too, not listed here.)

As such, each tool should have it's own .venv where python installs dependncies. These deps are used during local development, and then will be packaged in setup.py when the packaged version of the tool is created.

## Local Development

When you first start local develoment on this tool, you will need to do the following:

### Create python Environmet

Create a python environment for consistency, consider creating it with the specified python version python3.13

```
python3.13 -m venv .venv --prompt=doctool-env
```

Note: you could use a different python version e.g `python3 -m venv .venv` which would use whatever python version is currently setup on your path. (You can see this exactly by runnign `which python3`).

The prompt command just controls the name shown on the command line when the environment is active.

### Activate the Environment

Mac

```
source .venv/bin/activate
```

Windows

```
.venv\Scripts\activate
```

Activating the environment ensures that the python dependency manager installs all the dependencies in the active environment.

### Note on switching between venvs

If you are swithching between working on different tools with their own .venvs, in order to ensure isolation, you should run `deactivate` on the current `.venv` and then activate when you cd into the new dir.

**Important** VS-Code has it's own way of automatically injecting the python env based on configurable settings. TODO: Figure this out, and explain how developers can set up different envs for different tools -- for now, just rely on manual activation in the terminal shell.

To activate the python environment in a notebook in VS code, you can use _Cmd+Shift+P_ _Python: Select Interpreter_ and copy in the path of

```
<your_harlus_folder>/ml/tools/doc_search/.venv/bin/python3.13
```

### Package

To creat a new distribution:

```
pip install build
```

```
python -m build
```

This uses setup.py to create a "wheel" in in `/dist` with the latest version. This wheel includes the source code and required deps (it does not pakcage the deps).
