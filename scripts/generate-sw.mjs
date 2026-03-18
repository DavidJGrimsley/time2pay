import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { generateSW } from 'workbox-build';

const repoRoot = process.cwd();
const clientBuildDir = path.join(repoRoot, 'dist', 'client');
const serverBuildDir = path.join(repoRoot, 'dist', 'server');

const htmlRouteMap = [
  ['/', 'index.html'],
  ['/bank', 'bank.html'],
  ['/dashboard', 'dashboard.html'],
  ['/invoices', 'invoices.html'],
  ['/payments', 'payments.html'],
  ['/profile', 'profile.html'],
  ['/sessions', 'sessions.html'],
];

async function ensureDirectory(dirPath, label) {
  const stat = await fs
    .stat(dirPath)
    .catch(() => null);
  if (!stat?.isDirectory()) {
    throw new Error(`${label} not found at ${dirPath}. Run "expo export -p web" first.`);
  }
}

async function hashFile(filePath) {
  const fileBuffer = await fs.readFile(filePath);
  return createHash('sha256').update(fileBuffer).digest('hex').slice(0, 16);
}

async function createHtmlManifestEntries() {
  const entries = [];

  for (const [url, filename] of htmlRouteMap) {
    const filePath = path.join(serverBuildDir, filename);
    const fileExists = await fs
      .stat(filePath)
      .then((stat) => stat.isFile())
      .catch(() => false);

    if (!fileExists) {
      console.warn(`Skipping precache entry: missing ${path.relative(repoRoot, filePath)}`);
      continue;
    }

    entries.push({
      url,
      revision: await hashFile(filePath),
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
    globPatterns: ['**/*.{css,html,ico,js,json,png,svg,txt,wasm,woff,woff2}'],
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
