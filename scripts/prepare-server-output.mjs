import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  discoverApiRouteSources,
  discoverExportedHtmlPages,
  loadExpoRouterPluginConfig,
  serverBuildDir,
  toPosixPath,
  toRelativeImportPath,
} from './web-output-utils.mjs';

const generatedFunctionsDir = path.join(serverBuildDir, '_expo', 'functions-generated');
const routesManifestPath = path.join(serverBuildDir, '_expo', 'routes.json');

function toGeneratedWrapperRelativePath(pagePath) {
  return toPosixPath(path.join('_expo', 'functions-generated', `${pagePath}.cjs`));
}

async function writeApiWrapper(route) {
  const wrapperRelativePath = toGeneratedWrapperRelativePath(route.pagePath);
  const wrapperPath = path.join(serverBuildDir, wrapperRelativePath);
  const sourceImportPath = toRelativeImportPath(
    path.relative(path.dirname(wrapperPath), route.sourcePath),
  );

  await fs.mkdir(path.dirname(wrapperPath), { recursive: true });
  await fs.writeFile(
    wrapperPath,
    `'use strict';\nmodule.exports = require(${JSON.stringify(sourceImportPath)});\n`,
    'utf-8',
  );

  return wrapperRelativePath;
}

async function main() {
  const exportedHtmlPages = await discoverExportedHtmlPages();
  const apiRouteSources = await discoverApiRouteSources();
  const expoRouterConfig = await loadExpoRouterPluginConfig();

  await fs.rm(generatedFunctionsDir, { recursive: true, force: true });
  await fs.mkdir(path.dirname(routesManifestPath), { recursive: true });

  const htmlRoutes = exportedHtmlPages
    .filter((page) => !page.isInternal && !page.isNotFound)
    .map((page) => ({
      file: page.relativePath,
      page: page.pagePath,
      namedRegex: page.urlPath === '/' ? '^/$' : `^${page.urlPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:/)?$`,
      routeKeys: {},
    }));

  const notFoundPage = exportedHtmlPages.find((page) => page.isNotFound);
  const notFoundRoutes = notFoundPage
    ? [
        {
          file: notFoundPage.relativePath,
          page: notFoundPage.pagePath,
          namedRegex: '^/.*$',
          routeKeys: {},
        },
      ]
    : [];

  const apiRoutes = [];
  for (const apiRoute of apiRouteSources) {
    const wrapperRelativePath = await writeApiWrapper(apiRoute);
    apiRoutes.push({
      file: wrapperRelativePath,
      page: apiRoute.pagePath,
      namedRegex: apiRoute.namedRegex,
      routeKeys: apiRoute.routeKeys,
    });
  }

  const manifest = {
    ...(expoRouterConfig.headers ? { headers: expoRouterConfig.headers } : {}),
    apiRoutes,
    htmlRoutes,
    notFoundRoutes,
    redirects: [],
    rewrites: [],
  };

  await fs.writeFile(routesManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');

  console.log(
    `Prepared ${path.relative(process.cwd(), routesManifestPath)} with ${htmlRoutes.length} HTML routes and ${apiRoutes.length} API routes.`,
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
