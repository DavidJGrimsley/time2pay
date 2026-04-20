import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import {
  clientBuildDir,
  discoverApiRouteSources,
  repoRoot,
  serverBuildDir,
  toPosixPath,
} from './web-output-utils.mjs';

const require = createRequire(import.meta.url);
const { readFirstEnvFile } = require('./env-loader.cjs');

const WINDOWS_ACCESS_VIOLATION_EXIT_CODES = new Set([3221225477, -1073741819]);
const STRICT_LOCAL_MODE_BUILD_FLAG = 'TIME2PAY_FAIL_BUILD_IF_LOCAL';
const HOSTED_MODE_VALUE = 'hosted';

function isTruthy(value) {
  return /^(1|true|yes|on)$/i.test(value.trim());
}

async function resolveBuildEnvironment() {
  const { envFromFile, sourceFile } = readFirstEnvFile({ cwd: repoRoot });

  const resolvedEnv = {
    ...envFromFile,
    ...process.env,
  };

  const rawMode = resolvedEnv.EXPO_PUBLIC_TIME2PAY_DATA_MODE?.trim().toLowerCase() ?? '';
  const resolvedMode = rawMode === HOSTED_MODE_VALUE ? HOSTED_MODE_VALUE : 'local';
  const modeSource = process.env.EXPO_PUBLIC_TIME2PAY_DATA_MODE?.trim()
    ? 'process.env'
    : envFromFile.EXPO_PUBLIC_TIME2PAY_DATA_MODE?.trim()
      ? sourceFile ?? 'env file'
      : 'default(local)';

  if (sourceFile) {
    console.log(`[export-web] Loaded ${sourceFile}`);
  } else {
    console.log('[export-web] No env file found (checked .env, .env.test, .env.production).');
  }

  console.log(
    `[export-web] Resolved EXPO_PUBLIC_TIME2PAY_DATA_MODE=${resolvedMode} (source: ${modeSource})`,
  );

  const strictModeEnabled = isTruthy(resolvedEnv[STRICT_LOCAL_MODE_BUILD_FLAG]?.trim() ?? '');
  if (strictModeEnabled && resolvedMode !== HOSTED_MODE_VALUE) {
    throw new Error(
      `[export-web] ${STRICT_LOCAL_MODE_BUILD_FLAG}=1 blocks local-mode web exports. ` +
        'Set EXPO_PUBLIC_TIME2PAY_DATA_MODE=hosted before building deployment artifacts.',
    );
  }

  return resolvedEnv;
}

async function exportArtifactsLookValid() {
  const requiredPaths = [
    path.join(serverBuildDir, 'index.html'),
    path.join(serverBuildDir, '(tabs)', 'dashboard.html'),
    path.join(clientBuildDir, '_expo', 'static'),
  ];

  for (const requiredPath of requiredPaths) {
    const stat = await fs.stat(requiredPath).catch(() => null);
    if (!stat) {
      return false;
    }
  }

  const apiRouteSources = await discoverApiRouteSources();
  for (const apiRoute of apiRouteSources) {
    const relativeFunctionPath = toPosixPath(
      path.join('_expo', 'functions', `${apiRoute.pagePath}+api.js`),
    );
    const builtFunctionPath = path.join(serverBuildDir, relativeFunctionPath);
    const functionStat = await fs.stat(builtFunctionPath).catch(() => null);
    if (!functionStat) {
      return false;
    }
  }

  return true;
}

async function runExpoExport(resolvedEnv) {
  const isWindows = process.platform === 'win32';
  const command = isWindows ? 'cmd.exe' : 'npx';
  const args = isWindows ? ['/d', '/s', '/c', 'npx expo export -p web'] : ['expo', 'export', '-p', 'web'];

  const child = spawn(command, args, {
    cwd: repoRoot,
    env: resolvedEnv,
    stdio: 'inherit',
    shell: false,
  });

  const exitCode = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? 0));
  });

  return { exitCode, isWindows };
}

async function main() {
  const resolvedEnv = await resolveBuildEnvironment();
  const firstAttempt = await runExpoExport(resolvedEnv);
  const { isWindows } = firstAttempt;
  let exitCode = firstAttempt.exitCode;

  if (exitCode !== 0 && isWindows && WINDOWS_ACCESS_VIOLATION_EXIT_CODES.has(exitCode)) {
    const artifactsLookValid = await exportArtifactsLookValid();
    if (!artifactsLookValid) {
      console.warn(
        'Expo export exited with a Windows access violation and left incomplete server artifacts. Retrying once...',
      );
      const retryAttempt = await runExpoExport(resolvedEnv);
      exitCode = retryAttempt.exitCode;
    }
  }

  if (exitCode === 0) {
    return;
  }

  const artifactsLookValid = await exportArtifactsLookValid();
  if (artifactsLookValid && WINDOWS_ACCESS_VIOLATION_EXIT_CODES.has(exitCode)) {
    console.warn(
      'Expo export finished writing the web bundle but exited with a Windows access violation. Continuing because dist output looks complete.',
    );
    return;
  }

  process.exit(exitCode || 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
