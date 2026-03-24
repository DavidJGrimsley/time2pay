#!/bin/sh
set -eu

cd "$(dirname "$0")/.."

echo "[plesk-post-deploy] Installing dependencies"
npm ci --include=dev

echo "[plesk-post-deploy] Building web output"
npm run build:web:deploy

echo "[plesk-post-deploy] Requesting app restart"
touch ../tmp/restart.txt
