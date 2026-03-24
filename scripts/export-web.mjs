import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { clientBuildDir, repoRoot, serverBuildDir } from './web-output-utils.mjs';

const WINDOWS_ACCESS_VIOLATION_EXIT_CODES = new Set([3221225477, -1073741819]);

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

  return true;
}

async function main() {
  const isWindows = process.platform === 'win32';
  const command = isWindows ? 'cmd.exe' : 'npx';
  const args = isWindows ? ['/d', '/s', '/c', 'npx expo export -p web'] : ['expo', 'export', '-p', 'web'];

  const child = spawn(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: false,
  });

  const exitCode = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? 0));
  });

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
