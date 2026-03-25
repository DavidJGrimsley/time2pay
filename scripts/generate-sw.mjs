import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { generateSW } from 'workbox-build';
import {
  clientBuildDir,
  discoverExportedHtmlPages,
  ensureDirectory,
  repoRoot,
  serverBuildDir,
} from './web-output-utils.mjs';

async function hashFile(filePath) {
  const fileBuffer = await fs.readFile(filePath);
  return createHash('sha256').update(fileBuffer).digest('hex').slice(0, 16);
}

async function createHtmlManifestEntries() {
  const htmlPages = await discoverExportedHtmlPages(serverBuildDir);
  const entries = [];

  for (const htmlPage of htmlPages) {
    if (htmlPage.isInternal || htmlPage.isNotFound) {
      continue;
    }

    entries.push({
      url: htmlPage.urlPath,
      revision: await hashFile(htmlPage.filePath),
    });
  }

  return entries;
}

async function main() {
  await ensureDirectory(clientBuildDir, 'Client build directory');
  await ensureDirectory(serverBuildDir, 'Server build directory');

  const additionalManifestEntries = await createHtmlManifestEntries();
  const swDest = path.join(clientBuildDir, 'sw.js');

  const { count, size, warnings } = await generateSW({
    swDest,
    globDirectory: clientBuildDir,
    globPatterns: ['**/*.{css,html,ico,js,json,png,svg,txt,wasm,woff,woff2,xml}'],
    ignoreURLParametersMatching: [/^utm_/, /^fbclid$/],
    additionalManifestEntries,
    skipWaiting: true,
    clientsClaim: true,
    cleanupOutdatedCaches: true,
    maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
    sourcemap: false,
    runtimeCaching: [
      {
        urlPattern: /\/api\//,
        handler: 'NetworkOnly',
        method: 'GET',
      },
    ],
  });

  if (warnings.length > 0) {
    console.warn('Workbox warnings:');
    for (const warning of warnings) {
      console.warn(`- ${warning}`);
    }
  }

  console.log(
    `Generated ${path.relative(repoRoot, swDest)} with ${count} precached entries (${size} bytes).`,
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
