const path = require('node:path');
const compression = require('compression');
const express = require('express');
const morgan = require('morgan');
const { createRequestHandler } = require('expo-server/adapter/express');

const app = express();
const port = Number(process.env.PORT || 3000);
const clientBuildDir = path.join(__dirname, 'dist', 'client');
const serverBuildDir = path.join(__dirname, 'dist', 'server');

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

app.use(createRequestHandler({ build: serverBuildDir }));

app.listen(port, () => {
  console.log(`Time2Pay server listening on http://localhost:${port}`);
});
