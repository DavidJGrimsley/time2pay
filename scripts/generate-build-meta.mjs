import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

function safeGitRead(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function resolveCommitSha() {
  const fromEnv = (process.env.GITHUB_SHA || process.env.COMMIT_SHA || '').trim();
  if (fromEnv) {
    return fromEnv;
  }

  const fromGit = safeGitRead(['rev-parse', 'HEAD']);
  return fromGit || 'unknown';
}

function resolveBranchName() {
  const fromEnv = (process.env.GITHUB_REF_NAME || process.env.BRANCH_NAME || '').trim();
  if (fromEnv) {
    return fromEnv;
  }

  const fromGit = safeGitRead(['rev-parse', '--abbrev-ref', 'HEAD']);
  return fromGit || 'unknown';
}

async function main() {
  const repoRoot = process.cwd();
  const clientBuildDir = path.join(repoRoot, 'dist', 'client');
  const commitSha = resolveCommitSha();
  const commitShort = commitSha === 'unknown' ? 'unknown' : commitSha.slice(0, 12);
  const branch = resolveBranchName();
  const builtAt = new Date().toISOString();

  await fs.mkdir(clientBuildDir, { recursive: true });

  const jsonPath = path.join(clientBuildDir, '__time2pay_build.json');
  const textPath = path.join(clientBuildDir, '__time2pay_build.txt');
  const payload = {
    app: 'time2pay',
    commitSha,
    commitShort,
    branch,
    builtAt,
  };

  await fs.writeFile(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await fs.writeFile(textPath, `${commitSha}\n`, 'utf8');

  console.log(
    `[build-meta] Generated ${path.relative(repoRoot, jsonPath)} and ${path.relative(repoRoot, textPath)} for ${commitShort}.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
