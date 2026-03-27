import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  discoverApiRouteSources,
  discoverExportedHtmlPages,
  serverBuildDir,
  toPosixPath,
  loadExpoRouterPluginConfig,
} from './web-output-utils.mjs';

const routesManifestPath = path.join(serverBuildDir, '_expo', 'routes.json');

function toBuiltApiFunctionRelativePath(pagePath) {
  return toPosixPath(path.join('_expo', 'functions', `${pagePath}+api.js`));
}

async function main() {
  const exportedHtmlPages = await discoverExportedHtmlPages();
  const apiRouteSources = await discoverApiRouteSources();
  const expoRouterConfig = await loadExpoRouterPluginConfig();

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
    const builtFunctionRelativePath = toBuiltApiFunctionRelativePath(apiRoute.pagePath);
    const builtFunctionPath = path.join(serverBuildDir, builtFunctionRelativePath);
    const builtFunctionExists = await fs
      .access(builtFunctionPath)
      .then(() => true)
      .catch(() => false);

    if (!builtFunctionExists) {
      throw new Error(`Expected Expo API function output at ${builtFunctionPath}.`);
    }

    apiRoutes.push({
      file: builtFunctionRelativePath,
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
