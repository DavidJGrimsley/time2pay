import { promises as fs } from 'node:fs';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { config as loadEnvFile } from 'dotenv';
import { loadExpoRouterPluginConfig, publicDir } from './web-output-utils.mjs';

for (const envFileName of ['.env.build', '.env']) {
  const envPath = path.resolve(process.cwd(), envFileName);
  if (existsSync(envPath)) {
    loadEnvFile({ path: envPath, override: false });
  }
}

const INDEXED_PUBLIC_ROUTES = ['/'];
const PRIVATE_ROUTE_BLOCKLIST = ['/api/', '/_sitemap'];

function normalizeSiteOrigin(rawOrigin) {
  return new URL(rawOrigin).origin;
}

async function resolveSiteOrigin() {
  const configuredOrigin = process.env.EXPO_PUBLIC_SITE_ORIGIN?.trim();
  if (configuredOrigin) {
    return normalizeSiteOrigin(configuredOrigin);
  }

  const expoRouterConfig = await loadExpoRouterPluginConfig();
  if (typeof expoRouterConfig.origin === 'string' && expoRouterConfig.origin.trim()) {
    return normalizeSiteOrigin(expoRouterConfig.origin);
  }

  throw new Error(
    'EXPO_PUBLIC_SITE_ORIGIN is not configured. Set EXPO_PUBLIC_SITE_ORIGIN before building the web export.',
  );
}

function buildSitemapXml(siteOrigin) {
  const routeEntries = INDEXED_PUBLIC_ROUTES.map((route) => {
    const location = route === '/' ? `${siteOrigin}/` : `${siteOrigin}${route}`;
    return ['  <url>', `    <loc>${location}</loc>`, '  </url>'].join('\n');
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...routeEntries,
    '</urlset>',
    '',
  ].join('\n');
}

function buildRobotsTxt(siteOrigin) {
  return [
    'User-agent: *',
    'Allow: /',
    ...PRIVATE_ROUTE_BLOCKLIST.map((route) => `Disallow: ${route}`),
    '',
    `Sitemap: ${siteOrigin}/sitemap.xml`,
    '',
  ].join('\n');
}

async function main() {
  const siteOrigin = await resolveSiteOrigin();
  const sitemapPath = path.join(publicDir, 'sitemap.xml');
  const robotsPath = path.join(publicDir, 'robots.txt');

  await fs.mkdir(publicDir, { recursive: true });
  await fs.writeFile(sitemapPath, buildSitemapXml(siteOrigin), 'utf-8');
  await fs.writeFile(robotsPath, buildRobotsTxt(siteOrigin), 'utf-8');

  console.log(
    `Generated ${path.relative(process.cwd(), sitemapPath)} and ${path.relative(process.cwd(), robotsPath)} for ${siteOrigin}.`,
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
