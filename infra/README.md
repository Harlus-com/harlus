# Building Nginx

Build nginx:

```
docker build --platform linux/amd64 -t harlusregistry.azurecr.io/nginx-mtls:1 nginx-mtls
```

Push to registry:

```
docker push harlusregistry.azurecr.io/nginx-mtls:1
```

# Deploying container group

| What you want to do                                                | Command                                                     |
| ------------------------------------------------------------------ | ----------------------------------------------------------- |
| Restart the group in-place (pulls latest tag, keeps IP/DNS)        | `az container restart -g harlus-dev -n harlus-api-dev`      |
| Stop it (shuts containers down, keeps the definition & IP)         | `az container stop -g harlus-dev -n harlus-api-dev`         |
| Start it again after a stop                                        | `az container start -g harlus-dev -n harlus-api-dev`        |
| Delete the group entirely (IP/DNS released after a few minutes)    | `az container delete -g harlus-dev -n harlus-api-dev --yes` |
| Re-create from your YAML spec (after delete or to pick up changes) | `az container create -g harlus-dev -f aci.yaml`             |

# SSH Into contianer

az container exec \
 --resource-group harlus-dev \
 --name harlus-api-dev \
 --container-name api \
 --exec-command "/bin/bash"

# Logs stream

## Tail your FastAPI container

az container logs \
 --resource-group harlus-dev \
 --name harlus-api-dev \
 --container-name api \
 --follow

## Tail the NGINX mTLS sidecar

az container logs \
 -g harlus-dev \
 -n harlus-api-dev \
 --container-name tlsproxy \
 --follow

# File store

Make sure to export the following in you shell before running commands:

```
export AZURE_STORAGE_ACCOUNT="harlusstor"
export AZURE_STORAGE_KEY="H8zpP9WIaLZXmLFtwaDNGHBkuZooPATfVhPEzkXhdKRyygHencC3WertPRGYvMVVHzy1V3Q2uBjj+AStfayGUw=="
```

## List directories in the file store

az storage file list --share-name harlusshare --output table
or
az storage file list --share-name harlusshare/AMAT --output table
etc.

## Delete a file or folder:

Delete a file:

```
az storage file delete --share-name harlusshare --path <path-to-file> # excluding harlusshare
```

Delete a folder (must be empty)

```
az storage directory delete --share-name harlusshare --name <path-to-folder> # exlcuding harlusshare
```

Note: You can use the clean_share.sh to recursively delete files and folder (you can also ssh in).

# Health check

curl --cacert nginx-mtls/tls/ca.crt --key nginx-mtls/tls/client.key --cert nginx-mtls/tls/client.crt https://harlus-api-dev.eastus.azurecontainer.io/healthz

# Azure SSO

Now that we have Azure SSO, we could (and probably should drop lLient certificate )

| Purpose                   | Client certificate (mTLS)                               | Azure AD / OIDC token                                             |
| ------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------- |
| Who’s allowed to connect? | “Any device holding a cert signed by my CA.”            | “Any user / service principal I grant access in Entra ID.”        |
| Identity you get in code  | Device-level, anonymous beyond the CN.                  | User object ID, tenant ID, email, groups, roles, etc.             |
| Browser support           | Manual PFX install or smart-card prompt for every user. | Native login popup (Microsoft 365 SSO) or silent token from MSAL. |
| Typical use               | Device-to-device, internal service mesh.                | Public or partner-facing APIs / SPAs / mobile apps.               |

So if you adopt Azure AD you can drop the client certificate layer.
TLS is still required for encryption, but mTLS is optional once bearer-token auth controls access.
