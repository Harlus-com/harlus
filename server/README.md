### First Time Setup

### Create python Environment

See python/env/README.md

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

### Integrating Tools

Note: since tools makes use of the on-disk cache, when making changes to a tool dir, you might need to delete the server on disk cache (found under app_data_path)

### Building and running docker:

1. docker build -t harlus-local . (must be run from harlus root dir)
2. docker run -p 8000:8000 harlus-local

Note: You will have to install docker first

Note: `-t` stands for tag, and tags the respository of the image as harlus-local. The "tag" then defualts to `latest`. If we wanted to provide a specific tag, we could use `-t harlus:server:v1`. To see the images, run `docker images`.

Note: `-p` maps from the host port to conatiner port.

## To use swagger api:

http://localhost:8000/docs

Add a bearer token (got from the front end) and paste it into "authorize" section
