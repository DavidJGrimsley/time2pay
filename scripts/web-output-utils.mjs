import { promises as fs } from 'node:fs';
import path from 'node:path';

export const repoRoot = process.cwd();
export const appDir = path.join(repoRoot, 'src', 'app');
export const publicDir = path.join(repoRoot, 'public');
export const distDir = path.join(repoRoot, 'dist');
export const clientBuildDir = path.join(distDir, 'client');
export const serverBuildDir = path.join(distDir, 'server');

const API_ROUTE_EXTENSION_PATTERN = /\+api\.[cm]?[jt]sx?$/i;
const HTML_EXTENSION_PATTERN = /\.html$/i;

export function toPosixPath(value) {
  return value.replace(/\\/g, '/');
}

export function toRelativeImportPath(value) {
  const normalizedValue = toPosixPath(value);
  return normalizedValue.startsWith('.') ? normalizedValue : `./${normalizedValue}`;
}

export async function ensureDirectory(dirPath, label) {
  const stat = await fs.stat(dirPath).catch(() => null);
  if (!stat?.isDirectory()) {
    throw new Error(`${label} not found at ${dirPath}. Run the web export first.`);
  }
}

async function walkFiles(dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const sortedEntries = [...entries].sort((left, right) => left.name.localeCompare(right.name));
  const files = [];

  for (const entry of sortedEntries) {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(entryPath)));
      continue;
    }

    if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

function stripFileExtension(filePath, pattern) {
  return toPosixPath(filePath).replace(pattern, '');
}

function isRouteGroupSegment(segment) {
  return /^\(.*\)$/.test(segment);
}

function isNotFoundHtmlPage(relativeHtmlPath) {
  return path.posix.basename(relativeHtmlPath, '.html') === '+not-found';
}

function isInternalHtmlPage(relativeHtmlPath) {
  return path.posix.basename(relativeHtmlPath, '.html').startsWith('_');
}

export function toPublicRoutePathFromPagePath(pagePath) {
  const visibleSegments = toPosixPath(pagePath)
    .split('/')
    .filter(Boolean)
    .filter((segment) => !isRouteGroupSegment(segment));

  if (visibleSegments[visibleSegments.length - 1] === 'index') {
    visibleSegments.pop();
  }

  return visibleSegments.length === 0 ? '/' : `/${visibleSegments.join('/')}`;
}

export function toPublicRoutePathFromHtml(relativeHtmlPath) {
  return toPublicRoutePathFromPagePath(stripFileExtension(relativeHtmlPath, HTML_EXTENSION_PATTERN));
}

export function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function buildNamedRegexFromStaticUrlPath(urlPath) {
  return urlPath === '/' ? '^/$' : `^${escapeRegex(urlPath)}(?:/)?$`;
}

function normalizeRouteParamName(segmentName) {
  const safeName = segmentName.replace(/[^A-Za-z0-9_$]/g, '_');
  return /^[A-Za-z_$]/.test(safeName) ? safeName : `_${safeName}`;
}

export function buildNamedRegexFromPagePath(pagePath) {
  const visibleSegments = toPosixPath(pagePath)
    .split('/')
    .filter(Boolean)
    .filter((segment) => !isRouteGroupSegment(segment));

  if (visibleSegments[visibleSegments.length - 1] === 'index') {
    visibleSegments.pop();
  }

  if (visibleSegments.length === 0) {
    return { namedRegex: '^/$', routeKeys: {} };
  }

  const routeKeys = {};
  let namedRegex = '^';

  for (const segment of visibleSegments) {
    const optionalCatchAllMatch = /^\[\[\.\.\.(.+)\]\]$/.exec(segment);
    if (optionalCatchAllMatch) {
      const originalName = optionalCatchAllMatch[1];
      const safeName = normalizeRouteParamName(originalName);
      routeKeys[safeName] = originalName;
      namedRegex += `(?:/(?<${safeName}>.*))?`;
      continue;
    }

    const catchAllMatch = /^\[\.\.\.(.+)\]$/.exec(segment);
    if (catchAllMatch) {
      const originalName = catchAllMatch[1];
      const safeName = normalizeRouteParamName(originalName);
      routeKeys[safeName] = originalName;
      namedRegex += `/(?<${safeName}>.+?)`;
      continue;
    }

    const dynamicMatch = /^\[(.+)\]$/.exec(segment);
    if (dynamicMatch) {
      const originalName = dynamicMatch[1];
      const safeName = normalizeRouteParamName(originalName);
      routeKeys[safeName] = originalName;
      namedRegex += `/(?<${safeName}>[^/]+?)`;
      continue;
    }

    namedRegex += `/${escapeRegex(segment)}`;
  }

  namedRegex += '(?:/)?$';
  return { namedRegex, routeKeys };
}

export async function discoverExportedHtmlPages(serverDir = serverBuildDir) {
  await ensureDirectory(serverDir, 'Server build directory');

  const htmlFiles = (await walkFiles(serverDir))
    .filter((filePath) => HTML_EXTENSION_PATTERN.test(filePath))
    .sort((left, right) => left.localeCompare(right));

  return htmlFiles.map((filePath) => {
    const relativePath = toPosixPath(path.relative(serverDir, filePath));
    const pagePath = stripFileExtension(relativePath, HTML_EXTENSION_PATTERN);
    const urlPath = toPublicRoutePathFromHtml(relativePath);
    return {
      filePath,
      relativePath,
      pagePath,
      urlPath,
      isInternal: isInternalHtmlPage(relativePath),
      isNotFound: isNotFoundHtmlPage(relativePath),
    };
  });
}

export async function discoverApiRouteSources(appRoot = appDir) {
  await ensureDirectory(appRoot, 'App directory');

  const routeFiles = (await walkFiles(appRoot))
    .filter((filePath) => API_ROUTE_EXTENSION_PATTERN.test(filePath))
    .sort((left, right) => left.localeCompare(right));

  return routeFiles.map((sourcePath) => {
    const relativeSourcePath = toPosixPath(path.relative(appRoot, sourcePath));
    const pagePath = stripFileExtension(relativeSourcePath, API_ROUTE_EXTENSION_PATTERN);
    const { namedRegex, routeKeys } = buildNamedRegexFromPagePath(pagePath);

    return {
      sourcePath,
      relativeSourcePath,
      pagePath,
      urlPath: toPublicRoutePathFromPagePath(pagePath),
      namedRegex,
      routeKeys,
    };
  });
}

export async function loadExpoRouterPluginConfig() {
  const appJsonPath = path.join(repoRoot, 'app.json');
  const appJson = JSON.parse(await fs.readFile(appJsonPath, 'utf-8'));
  const plugins = appJson?.expo?.plugins ?? [];

  for (const plugin of plugins) {
    if (plugin === 'expo-router') {
      return {};
    }

    if (Array.isArray(plugin) && plugin[0] === 'expo-router') {
      return plugin[1] ?? {};
    }
  }

  return {};
}
