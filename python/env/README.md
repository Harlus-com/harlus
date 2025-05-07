### Background

This serves as a universal python environment for all python code in Harlus.

At some point in the future, we may try to formally isolate dependencies of different tools from the server, but after trying that for a week, we've decided the benefits (if any at this point) do not out-weigh the extra coplexity. In short, we are developing and changing so quickly, that pinned versions don't provide value.

This directory houses the .venv virtual python environment which will contain all dependencies for all python code in Harlus.

This means when running code in a jupyter notebook in ml/tools or when running the backend server, **this single "harlus-env" must be activated**.

### Create python Environmet

Create a python environment for consistency, consider creating it with the specified python version python3.13

```
python3.13 -m venv .venv --prompt=harlus-env
```

Note: you could use a different python version e.g `python3 -m venv .venv` which would use whatever python version is currently setup on your path. (You can see this exactly by running `which python3`).

The prompt command just controls the name
shown on the command line when the environment is active.

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

### Install requirements.txt

```
pip install -r requirements.txt
```

### Install Local Packages

```
python scripts/package.py --link
```

This will add the `ml/tools` "packages" to the environment, locally linked. "Packages" is in quotes, because while they technically are "packages" they are locally linked, so any changes in those directeries, whill be reflected in any python code anywhere in harlus, that executes `ml/tools` code.

### How to install new packages

```
pip install <package-name>
```

```
pip freeze > requirements.txt
```

TODO: We need a way to prune unused dependenices from requirements.txt
TODO: We need a way to drop dependenices not specifified (but that were previously specified or otherwise eneded up in site-packages) from site packages.

### More on local packages

If you wanted, you could also _actually_ package a local tool.

```
python scripts/package.py --package <tool_dir>
```

e.g `python scripts/package.py --package chat`

This will create a python wheel which get's copied into python/env/wheels. Then the script will explicitly install that wheel, meaning that if you make changes to the tool directory, they won't be reflected in the environment (i.e by other packages that import the tool). However changes in the tool dir would still be reflected in a local notebook that directly imports the tool files.

If you do this you can also switch between the packaged version and the direct link using

```
python scripts/package.py --tool-name <tool_dir> --link 
```

or directly using

```
pip install -e <tool_dir>
```


And

```
python scripts/package.py --unlink <tool_dir>
```

Ultimately though, there is probably not much reason to do this.

One way to think abotu the "packaged" version is that it just takes a snapshot of the code under the tool dir and copies it into site packages.

#### Other Details

- We don't specify the tool as a dependency in requirements.txt, because we just manually link it
- We don't change the tool package version becasue this is just confusing, given the package version means nothing
- We don't check in the wheels under python/env/wheels, because they are irrelevant (**but don't delete the empty `wheels` directory!**)

#### Why do all this?

At some point we might want / need to switch to a formal package architecture. When that day comes, this will be easy enough, given we've already set everything up with "package isolation" even though we don't pin versions and just link everything locally.

#### Other Learnings from Local Packages

- Package names must be globably unique if we use them in the future (hence the "harlus" prefix)

## Setting up VS Code with Python

harlus.code-workspace specifies the defualt interpreter to the global python environment.

```
{
  "python.defaultInterpreterPath": "python/env/.venv/bin/python3.13"
}
```

If this doesn't work, you may also have to run the "Python: Select Interpreter" VS Code command afterwards (it should appear as an option in the dropdown).

If it doens't appear in the drop down, you can manually specify the path.

Note: You interpreter might struggle to recognize locally linked packages, if so, and you are not developing a tool, you can just point to the packaged versions at the start of your developing session by running `python scripts/package.py --package`
