# ---------------------------------------------------------------------------------

# 0. One-time prerequisites (if you haven’t already done them in this shell)

# ---------------------------------------------------------------------------------

az login # Azure CLI signed-in
az acr login -n harlusregistry # Docker logged into ACR

# ---------------------------------------------------------------------------------

# 1. Build & tag the new image (ALWAYS build for linux/amd64 on Apple silicon)

# ---------------------------------------------------------------------------------

docker build --platform linux/amd64 -t harlusregistry.azurecr.io/harlus-server:latest .

# ---------------------------------------------------------------------------------

# 2. Push to Azure Container Registry

# ---------------------------------------------------------------------------------

docker push harlusregistry.azurecr.io/harlus-server:latest

# (Verify)

az acr repository show-tags -n harlusregistry --repository harlus-server -o table

# ---------------------------------------------------------------------------------

# 3. Restart the container intsnace to pick up the new latest

az container restart --resource-group harlus-dev --name harlus-api

Note: If you want to change anything else, you have to re-run the "create command" (see below)

# 4. Smoke test

# ---------------------------------------------------------------------------------

# Logs stream (Ctrl-C to exit)

az container logs -g harlus-dev -n harlus-api --follow

# Health check from your laptop

curl -I https://harlus-api-dev.eastus.azurecontainer.io:8000/healthz

or load https://harlus-api-dev.eastus.azurecontainer.io:8000/docs in browser

# SSH into the container

az container exec --resource-group harlus-dev --name harlus-api --exec-command "/bin/bash"

# Create command:

az container create \
 --resource-group harlus-dev \
 --name harlus-api \
 --image harlusregistry.azurecr.io/harlus-server:latest \
 --cpu 2 --memory 4 --os-type Linux \
 --ports 8000 \
 --dns-name-label harlus-api-dev \
 --registry-login-server harlusregistry.azurecr.io \
 --registry-username harlusregistry \
 --registry-password xxxx \
 --azure-file-volume-account-name harlusstor \
 --azure-file-volume-account-key xxx \
 --azure-file-volume-share-name harlusshare \
 --azure-file-volume-mount-path /data

(Do not leave out the file detials, or the external file system will get dropped)
