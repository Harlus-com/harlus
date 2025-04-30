### Firs Time Setup

### Create python Environmet

Create a python environment for consistency, consider creating it with the specified python version python3.13

```
python3.13 -m venv .venv --prompt=server-env
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

### Install UV

Note: If uv is already installed, you dont' need to do this

```
curl -LsSf https://astral.sh/uv/install.sh | sh
```

### Initialize Project with UV

```
uv venv
```

### Install requirements.txt

```
uv pip install -r requirements.txt
```

## How to install new packages

```
uv pip install <package-name>
```

```
uv pip freeze > requirements.txt
```

## Setting up VS Code with Python

You can optionally create a .vscode folder with /settings.json inside (in the root dir of the project)

Then add the default python interpreter:

```
{
  "python.defaultInterpreterPath": ".venv/bin/python3.13"
}
```

Note: You may also need to use the absolute path

Note: You may also have to run the "Python: Select Interpreter" VS Code command afterwards (it should appear as an option in the dropdown).

## Run the server

```
uvicorn main:app --reload
```

The `--reload` command will restart the server on file changes.

## Adding ml dependencies

Build the tool(s) as described in the README.md of the tool(s). Add the latest distribution to the `wheels` directory in `server`. Add the relevant wheels to requirements.txt

Right now our strategy will be to accumulate a history of wheel files, for stable versions.

If you overwrite a wheel file, you might have to install requriments with a force option to overwrite the code in .venv.

TODO: Find a way to run the server while using the latest code directly inside the tool dir (good for local develpment). This should be possible with something like `-e ../ml/tool/doc_parse` in requirements.txt

```requirements.txt
...
./wheels/tool-0.1.0-py3-none-any.whl
...
```

Note: if you need to debug an older tool version, when server has already moved foward (so you can't check out that commit), just edit the files directly in non-compiled site-packages.
