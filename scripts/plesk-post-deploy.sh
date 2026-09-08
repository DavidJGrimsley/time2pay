#!/bin/sh
set -eu

cd "$(dirname "$0")/.."

echo "[plesk-post-deploy] HEAD: $(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
echo "[plesk-post-deploy] Branch: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
echo "[plesk-post-deploy] Node: $(node --version 2>/dev/null || echo unknown)"
echo "[plesk-post-deploy] npm: $(npm --version 2>/dev/null || echo unknown)"
node -e "const pkg=require('./package.json'); console.log('[plesk-post-deploy] package versions: react-native=' + (pkg.dependencies?.['react-native'] ?? 'missing') + ' react-native-worklets=' + (pkg.dependencies?.['react-native-worklets'] ?? 'missing') + ' expo=' + (pkg.dependencies?.expo ?? 'missing'))"
env_file=""
for candidate in .env .env.test .env.production; do
  if [ -f "$candidate" ]; then
    env_file="$candidate"
    break
  fi
done
if [ -n "$env_file" ]; then
  echo "[plesk-post-deploy] Using $env_file"
else
  echo "[plesk-post-deploy] No file-based env detected"
fi

echo "[plesk-post-deploy] Installing dependencies"
npm ci --include=dev

if [ -d "dist" ]; then
  echo "[plesk-post-deploy] Existing dist ownership:"
  ls -ld dist || true

  if [ -w "dist" ]; then
    echo "[plesk-post-deploy] Removing writable dist"
    rm -rf dist
  else
    stale_dist="dist.stale.$(date +%Y%m%d%H%M%S)"
    echo "[plesk-post-deploy] dist is not writable; attempting to move it aside to $stale_dist"
    if mv dist "$stale_dist"; then
      echo "[plesk-post-deploy] Moved stale dist to $stale_dist"
    else
      echo "[plesk-post-deploy] Failed to move non-writable dist. Fix ownership, for example:" >&2
      echo "[plesk-post-deploy]   sudo chown -R \$(stat -c '%U:%G' .) dist" >&2
      exit 1
    fi
  fi
fi

echo "[plesk-post-deploy] Building web output"
npm run build:web:deploy

echo "[plesk-post-deploy] Requesting app restart"
touch ../tmp/restart.txt
