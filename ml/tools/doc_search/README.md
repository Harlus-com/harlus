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

**Important** VS-Code has it's own way of automatically injecting the python env based on configurable settings. If you unsure about your env, use `which python` to check which python is being used. You should see something like `path/to/harlus/server.venv/bin/python`.

To activate the python environment in a notebook in VS code, you can use _Cmd+Shift+P_ _Python: Select Interpreter_ and copy in the path of

```
path/to/harlus/ml/tools/doc_search/.venv/bin/python3.13
```

You can also try creating a `.vscode/settings.json` file in this directory with the following content:

```
{
  "python.defaultInterpreterPath": ".venv/bin/python3.13"
}

```

In theory, this should tell vscode to use the correct python interpreter for code editing (not running jupyter notebooks -- you'll have to choose the env there).

Unfortunately, after further research, this will only work if you tell vscode that that folder is a workspace, e.g.:

```
{
  "folders": [
    { "path": "." },
    { "path": "server" },
    { "path": "ml/tools/doc_search" }
  ],
  "settings": {
    "window.title": "Harlus"
  }
}
```

In harlus.code-workspace.

This includes the monorepo (".") and also the specific other workspaces. Then the switching works, but we see "server" and "doc_search" at top level next to "harlus".

So probably the best bet is to just manually switch the interpreter, even when editing files.

### Package

To creat a new distribution:

```
pip install build
```

```
python -m build
```

This uses setup.py to create a "wheel" in in `/dist` with the latest version. This wheel includes the source code and required deps (it does not pakcage the deps).
