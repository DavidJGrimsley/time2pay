/* global __dirname */
const { Buffer } = require('node:buffer');
const fs = require('node:fs');
const path = require('node:path');
const compression = require('compression');
const express = require('express');
const morgan = require('morgan');
const { createRequestHandler } = require('expo-server/adapter/express');
const { loadFirstEnvFile } = require('./scripts/env-loader.cjs');

loadFirstEnvFile({ cwd: __dirname, prefix: '[startup]' });

process.env.NODE_ENV = process.env.NODE_ENV || 'production';

const app = express();
const port = Number(process.env.PORT || 3000);
const isHostedDataMode =
  (process.env.EXPO_PUBLIC_TIME2PAY_DATA_MODE || 'local').trim().toLowerCase() === 'hosted';
const clientBuildDir = path.join(__dirname, 'dist', 'client');
const serverBuildDir = path.join(__dirname, 'dist', 'server');
const routesManifestPath = path.join(serverBuildDir, '_expo', 'routes.json');
const buildCommitMarkerPath = path.join(clientBuildDir, '__time2pay_build.txt');
const publicRuntimeEnvKeys = [
  'EXPO_PUBLIC_GITHUB_CLIENT_ID',
  'EXPO_PUBLIC_SITE_ORIGIN',
  'EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY',
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

function buildRequestUrl(req) {
  const host = req.get('host') || `localhost:${port}`;
  const protocol = req.protocol || 'http';
  return new URL(req.originalUrl || req.url, `${protocol}://${host}`).toString();
}

function buildRequestHeaders(req) {
  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      headers.set(key, value.join(', '));
      continue;
    }

    if (typeof value === 'string') {
      headers.set(key, value);
    }
  }

  return headers;
}

function buildRouteParams(route, match) {
  const groups = match?.groups || {};
  if (!route?.routeKeys || typeof route.routeKeys !== 'object') {
    return groups;
  }

  return Object.entries(route.routeKeys).reduce((params, [paramName, groupName]) => {
    params[paramName] = groups[groupName] ?? groups[paramName];
    return params;
  }, {});
}

async function handleDirectDbApiRoute(req, res, next) {
  const pathname = req.path || req.url;
  const matchedRoute = dbApiRoutes.find((route) => route.regex.test(pathname));

  if (!matchedRoute) {
    next();
    return;
  }

  try {
    const routeModulePath = path.join(serverBuildDir, matchedRoute.file);
    const routeModule = require(routeModulePath);
    const methodHandler = routeModule?.[req.method];

    if (typeof methodHandler !== 'function') {
      res.status(405).json({ error: `Unsupported method: ${req.method}` });
      return;
    }

    const requestBody =
      req.method === 'GET' || req.method === 'HEAD'
        ? undefined
        : JSON.stringify(req.body ?? {});

    const request = new Request(buildRequestUrl(req), {
      method: req.method,
      headers: buildRequestHeaders(req),
      body: requestBody,
    });

    const match = pathname.match(matchedRoute.regex);
    const response = await methodHandler(request, buildRouteParams(matchedRoute, match));

    res.status(response.status);
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    res.send(await response.text());
  } catch (error) {
    console.error('Direct DB API route failed:', error);
    next(error);
  }
}

async function handleDirectRawApiRoute(req, res, next, route) {
  try {
    const routeModulePath = path.join(serverBuildDir, route.file);
    const routeModule = require(routeModulePath);
    const methodHandler = routeModule?.[req.method];

    if (typeof methodHandler !== 'function') {
      res.status(405).json({ error: `Unsupported method: ${req.method}` });
      return;
    }

    const request = new Request(buildRequestUrl(req), {
      method: req.method,
      headers: buildRequestHeaders(req),
      body: Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0),
    });
    const response = await methodHandler(request, {});

    res.status(response.status);
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });

    res.send(await response.text());
  } catch (error) {
    console.error('Direct raw API route failed:', error);
    next(error);
  }
}

assertBuildArtifact(clientBuildDir, 'Client build directory');
assertBuildArtifact(serverBuildDir, 'Server build directory');
assertBuildArtifact(routesManifestPath, 'Generated Expo routes manifest');
assertBuildArtifact(buildCommitMarkerPath, 'Build commit marker');
assertHostedRuntimeEnvHealth();

const routesManifest = JSON.parse(fs.readFileSync(routesManifestPath, 'utf8'));
const apiRoutes = routesManifest.apiRoutes || [];
const dbApiRoutes = apiRoutes
  .filter((route) => typeof route?.page === 'string' && route.page.startsWith('api/db/'))
  .map((route) => ({
    ...route,
    regex: new RegExp(route.namedRegex),
  }));
const stripeWebhookRoute = apiRoutes.find((route) => route?.page === 'api/webhooks/stripe');

app.disable('x-powered-by');
app.use(compression());
app.use(morgan('tiny'));

if (!isHostedDataMode) {
  // Required for expo-sqlite web persistence. Hosted mode omits cross-origin
  // isolation because Stripe embedded Checkout does not support isolated pages.
  app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    next();
  });
}

app.get('/__time2pay_runtime_config__', (_req, res) => {
  res.type('application/javascript');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.send(
    `window.__TIME2PAY_RUNTIME_CONFIG__ = Object.freeze(${JSON.stringify(buildPublicRuntimeConfig())});\n`,
  );
});

app.get('/__time2pay_build.txt', (_req, res) => {
  res.type('text/plain');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(buildCommitMarkerPath);
});

app.use('/api/db', express.json({ limit: '1mb' }));
app.all('/api/db/{*route}', handleDirectDbApiRoute);

if (stripeWebhookRoute) {
  app.post(
    '/api/webhooks/stripe',
    express.raw({ type: 'application/json', limit: '1mb' }),
    (req, res, next) => handleDirectRawApiRoute(req, res, next, stripeWebhookRoute),
  );
}

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
