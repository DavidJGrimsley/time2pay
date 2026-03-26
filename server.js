/* global __dirname */
const fs = require('node:fs');
const path = require('node:path');
const compression = require('compression');
const express = require('express');
const morgan = require('morgan');
const { createRequestHandler } = require('expo-server/adapter/express');
const { register } = require('tsx/cjs/api');

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
register({ namespace: 'time2pay-prod-server' });

const app = express();
const port = Number(process.env.PORT || 3000);
const clientBuildDir = path.join(__dirname, 'dist', 'client');
const serverBuildDir = path.join(__dirname, 'dist', 'server');
const routesManifestPath = path.join(serverBuildDir, '_expo', 'routes.json');

function assertBuildArtifact(filePath, description) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${description} not found at ${filePath}. Run "npm run build:web:deploy" first.`);
  }
}

assertBuildArtifact(clientBuildDir, 'Client build directory');
assertBuildArtifact(serverBuildDir, 'Server build directory');
assertBuildArtifact(routesManifestPath, 'Generated Expo routes manifest');

app.disable('x-powered-by');
app.use(compression());
app.use(morgan('tiny'));

// Required for expo-sqlite web persistence.
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  next();
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

app.listen(port, () => {
  console.log(`Time2Pay server listening on http://localhost:${port}`);
});
