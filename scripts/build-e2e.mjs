import { spawn } from 'node:child_process';
import { createE2eEnvironment } from './e2e-env.mjs';

const npmCli = process.env.npm_execpath;
if (!npmCli) {
  throw new Error('build:web:e2e must be launched through npm.');
}
const child = spawn(process.execPath, [npmCli, 'run', 'build:web:deploy'], {
  cwd: process.cwd(),
  env: createE2eEnvironment(),
  stdio: 'inherit',
  shell: false,
});

child.once('error', (error) => {
  console.error(error);
  process.exit(1);
});

child.once('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
