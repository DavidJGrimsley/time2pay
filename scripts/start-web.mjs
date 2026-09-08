import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const expoCli = fileURLToPath(new URL('../node_modules/expo/bin/cli', import.meta.url));
const child = spawn(process.execPath, [expoCli, 'start', '--web', ...process.argv.slice(2)], {
  cwd: process.cwd(),
  env: { ...process.env },
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
