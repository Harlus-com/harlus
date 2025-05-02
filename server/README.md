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

Pro Top: Add `alias activate="source .venv/bin/activate"` to your shell startup file (e.g `~/.bashrc`, `~/.zprofile` etc.) so that you can run `activate` in any directory with a .venv folder to activate the env.

Windows

```
.venv\Scripts\activate
```

Activating the environment ensures that the python dependency manager installs all the dependencies in the active environment.

### Install requirements.txt


```
pip install -r requirements.txt --find-links wheels
```
**note** the `find-links wheels` flag tells `pip` to look in the local wheels directory for pacakges in `requirements.txt` which it does not find on its standard `PyPi` index.


## How to install new packages

```
pip install <package-name>
```

```
pip freeze > requirements.txt
```

TODO: We need a way to prune unused dependenices from requirements.txt
TODO: We need a way to drop dependenices not specifified (but that were previously specified or otherwise eneded up in site-packages) from site packages.

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

```requirements.txt
...
./wheels/tool-0.1.0-py3-none-any.whl
...
```

Note: If you overwrite a wheel file, you might have to install requriments with a force option to overwrite the code in .venv.

Right now our strategy will be to accumulate a history of wheel files, for stable versions.

Note: Iff you need to debug an older tool version, when server has already moved foward (so you can't check out that commit), just edit the files directly in non-compiled site-packages.

### Helper script

Also consider using `python scripts/package.py {tool_name} --package` (this needs to be run from the harlus/server dir).

### Real time local development

If you want to simultatneously develop with the latest from an ml directory use the helper script.

```bash
python scripts/package.py {tool_name} --link
```

(e.g `python scripts/package.py contrast_tool --link`)

or to go back to using the local wheel

```bash
python scripts/package.py {tool_name} --unlink
```
