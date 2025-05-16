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

# Health check

curl --cacert nginx-mtls/tls/ca.crt --key nginx-mtls/tls/client.key --cert nginx-mtls/tls/client.crt ttps://harlus-api-dev.eastus.azurecontainer.io/healthz
