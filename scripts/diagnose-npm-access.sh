#!/usr/bin/env bash
set -euo pipefail

echo "== Node / npm =="
node -v
npm -v

echo

echo "== Registry =="
npm config get registry

echo

echo "== Proxy-related env =="
env | grep -i -E 'npm|proxy' || true

echo

echo "== npm ping (current env) =="
if npm ping; then
  echo "npm ping succeeded"
else
  echo "npm ping failed"
fi

echo

echo "== npm install (expected to fail fast if blocked) =="
if npm install --ignore-scripts --no-audit --no-fund; then
  echo "npm install succeeded"
else
  echo "npm install failed (see above)"
fi

echo

echo "== direct (no proxy env) npm ping =="
if env -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy -u npm_config_http_proxy -u npm_config_https_proxy npm ping; then
  echo "direct npm ping succeeded"
else
  echo "direct npm ping failed"
fi
