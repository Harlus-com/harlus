Note: This readme and Dockerfile should really live inside server. The issue, is that "server" takes dependnecies on ml, so the docker file has to be toplevel, to copy those files in.

Either we should move ml under server, or we should write a package script that copies what we need from them over (i.e like "link") or we should run them as their own container. Long term, I think their own contianer makes the most sense, but that could be a while from now, so probably just will leave this Dockerfile (and README) in an akward location.

# Build a new server image

## 1. Login

az login
az acr login -n harlusregistry

## 2. Build and push

#### This doesn't seem to cache the layers

Well, it does, if you have a big enough local cache.

docker build --platform linux/amd64 -t harlusregistry.azurecr.io/harlus-server:latest .
docker push harlusregistry.azurecr.io/harlus-server:latest

#### This does appear to cache layers (and push in one step)

This relies on a remote docker cache to cache layers, so thick layers don't get evicted (as often?)

docker buildx build --platform linux/amd64 --cache-to type=inline --cache-from type=registry,ref=harlusregistry.azurecr.io/harlus-server:latest -t harlusregistry.azurecr.io/harlus-server:latest --push .

More context: https://chatgpt.com/share/682fafc8-8af4-8013-9c4c-553b5aa5f9a4

## Commands for managing docker local mememory:

```
docker system df
```

Remove all layers from cache:

```
docker builder prune --all --force
```

Note: We can provide different tags if we want, but right now there is really no reason to keep a history or images, so we just use "latest"

### (Verify)

az acr repository show-tags -n harlusregistry --repository harlus-server -o table

# 3. Restart the container intsnace to pick up the new latest

az container restart --resource-group harlus-dev --name harlus-api-dev

Note: If you want to change anything else, you have to re-run the "create command" (see infra/README)
