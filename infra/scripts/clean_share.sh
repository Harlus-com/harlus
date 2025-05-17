#!/usr/bin/env bash
set -euo pipefail

AZURE_STORAGE_ACCOUNT="harlusstor"
AZURE_STORAGE_KEY="H8zpP9WIaLZXmLFtwaDNGHBkuZooPATfVhPEzkXhdKRyygHencC3WertPRGYvMVVHzy1V3Q2uBjj+AStfayGUw=="

# your file‐share
SHARE="harlusshare"

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <root-directory>"
  exit 1
fi

ROOT="$1"

clean_dir() {
  local DIR="$1"
  local file subdirs

  # 1) delete all files in this directory
  file=$(az storage file list \
    --share-name "$SHARE" \
    --path       "$DIR" \
    --query      "[?properties.contentLength!=\`null\`].name" \
    -o tsv)                                     # list only files :contentReference[oaicite:0]{index=0}
  for f in $file; do
    echo "Deleting file: $DIR/$f"
    az storage file delete \
      --share-name "$SHARE" \
      --path       "$DIR/$f"                   # delete file :contentReference[oaicite:1]{index=1}
  done

  # 2) recurse into sub-directories
  subdirs=$(az storage directory list \
    --share-name "$SHARE" \
    --name       "$DIR" \
    --query      "[].name" \
    -o tsv)                                     # list sub-folders :contentReference[oaicite:2]{index=2}
  for sub in $subdirs; do
    clean_dir "$DIR/$sub"
  done

  # 3) delete the now-empty directory
  echo "Deleting directory: $DIR"
  az storage directory delete \
    --share-name "$SHARE" \
    --name       "$DIR"                        # delete directory :contentReference[oaicite:3]{index=3}
}

clean_dir "$ROOT"
echo "✅ All done."