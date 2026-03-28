/* global __dirname */
const fs = require('node:fs');
const path = require('node:path');
const compression = require('compression');
const express = require('express');
const morgan = require('morgan');
const { createRequestHandler } = require('expo-server/adapter/express');

const envFilePath = path.join(__dirname, '.env');
if (fs.existsSync(envFilePath)) {
  try {
    // Local convenience: allow `node server.js` to pick up `.env` without extra flags.
    require('dotenv').config({ path: envFilePath });
  } catch {
    // no-op; runtime env vars may still be provided externally
  }
}

process.env.NODE_ENV = process.env.NODE_ENV || 'production';

const app = express();
const port = Number(process.env.PORT || 3000);
const clientBuildDir = path.join(__dirname, 'dist', 'client');
const serverBuildDir = path.join(__dirname, 'dist', 'server');
const routesManifestPath = path.join(serverBuildDir, '_expo', 'routes.json');
const publicRuntimeEnvKeys = [
  'EXPO_PUBLIC_GITHUB_CLIENT_ID',
  'EXPO_PUBLIC_SITE_ORIGIN',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_TIME2PAY_DATA_MODE',
];
const hostedRuntimeRequiredPublicEnvKeys = [
  'EXPO_PUBLIC_SITE_ORIGIN',
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
];
const hostedRuntimeDeprecatedEnvKeys = [
  'EXPO_PUBLIC_HOSTED_API_BASE_URL',
  'EXPO_PUBLIC_SUPABASE_AUTH_REDIRECT_URL',
  'EXPO_PUBLIC_SUPABASE_AUTH_REDIRECT_PATH',
  'EXPO_PUBLIC_MERCURY_PROXY_PATH',
  'SITE_ORIGIN',
];

function assertBuildArtifact(filePath, description) {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `${description} not found at ${filePath}. ` +
        'Run "npm run build:web:deploy" (or "npm run serve:prod:fresh") first. ' +
        'Note: dist artifacts are generated at build time and are not committed to git.',
    );
  }
}

function buildPublicRuntimeConfig() {
  return publicRuntimeEnvKeys.reduce((config, key) => {
    if (typeof process.env[key] === 'string') {
      config[key] = process.env[key];
    }

    return config;
  }, {});
}

function parseSiteOriginOrThrow(rawSiteOrigin) {
  let parsed;
  try {
    parsed = new URL(rawSiteOrigin);
  } catch {
    throw new Error('[startup] EXPO_PUBLIC_SITE_ORIGIN must be a valid absolute URL.');
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('[startup] EXPO_PUBLIC_SITE_ORIGIN must use http:// or https://.');
  }

  const hasNonRootPath = parsed.pathname !== '/' && parsed.pathname !== '';
  if (hasNonRootPath || parsed.search || parsed.hash) {
    throw new Error(
      '[startup] EXPO_PUBLIC_SITE_ORIGIN must be an origin without path, query, or hash (for example: "https://example.com").',
    );
  }
}

function assertHostedRuntimeEnvHealth() {
  const dataMode = (process.env.EXPO_PUBLIC_TIME2PAY_DATA_MODE || 'local').trim().toLowerCase();
  if (dataMode !== 'hosted') {
    console.log(`[startup] Data mode is "${dataMode || 'local'}". Hosted auth is disabled.`);
    return;
  }

  const missingKeys = hostedRuntimeRequiredPublicEnvKeys.filter(
    (key) => !String(process.env[key] || '').trim(),
  );
  if (missingKeys.length > 0) {
    throw new Error(
      `[startup] Hosted mode requires environment variables: ${missingKeys.join(', ')}`,
    );
  }

  const deprecatedKeys = hostedRuntimeDeprecatedEnvKeys.filter((key) =>
    Boolean(String(process.env[key] || '').trim()),
  );
  if (deprecatedKeys.length > 0) {
    throw new Error(
      `[startup] Hosted mode no longer supports deprecated environment variables: ${deprecatedKeys.join(', ')}`,
    );
  }

  parseSiteOriginOrThrow(process.env.EXPO_PUBLIC_SITE_ORIGIN.trim());
  console.log('[startup] Hosted mode env looks configured (strict contract passed).');
}

assertBuildArtifact(clientBuildDir, 'Client build directory');
assertBuildArtifact(serverBuildDir, 'Server build directory');
assertBuildArtifact(routesManifestPath, 'Generated Expo routes manifest');
assertHostedRuntimeEnvHealth();

app.disable('x-powered-by');
app.use(compression());
app.use(morgan('tiny'));

// Required for expo-sqlite web persistence.
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  next();
});

app.get('/__time2pay_runtime_config__', (_req, res) => {
  res.type('application/javascript');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.send(
    `window.__TIME2PAY_RUNTIME_CONFIG__ = Object.freeze(${JSON.stringify(buildPublicRuntimeConfig())});\n`,
  );
});

app.use(
  express.static(clientBuildDir, {
    index: false,
    redirect: false,
    maxAge: '1h',
    setHeaders: (res, filePath) => {
      const normalizedPath = filePath.replace(/\\/g, '/');
      const isServiceWorker = normalizedPath.endsWith('/sw.js');
      const isWorkboxRuntime = /\/workbox-[^/]+\.js$/.test(normalizedPath);

      if (isServiceWorker || isWorkboxRuntime) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    },
  }),
);

const requestHandler = createRequestHandler({
  build: serverBuildDir,
  isDevelopment: false,
});

app.all(['/', '/{*route}'], requestHandler);

app.use((error, _req, res, _next) => {
  console.error('Time2Pay server request failed:', error);
  if (res.headersSent) {
    return;
  }

  res.status(500).type('text/plain').send('Internal server error');
});

const server = app.listen(port, () => {
  console.log(`Time2Pay server listening on http://localhost:${port}`);
});

// Some hosting/dev shells can leave the HTTP listener unreferenced.
// Force a strong reference so the Node process stays alive after startup.
if (typeof server.ref === 'function') {
  server.ref();
}
