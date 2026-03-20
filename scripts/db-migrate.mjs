import 'dotenv/config';
import { spawn } from 'node:child_process';
import postgres from 'postgres';

const URL_PRECEDENCE = ['DRIZZLE_DATABASE_URL', 'DATABASE_URL', 'DATABASE_DIRECT_URL'];
const chosenEnvKey = URL_PRECEDENCE.find((key) => process.env[key]?.trim());
const selectedUrl = chosenEnvKey ? process.env[chosenEnvKey]?.trim() : '';

if (!selectedUrl) {
  console.error('[db:migrate] No database URL found.');
  console.error('[db:migrate] Set one of: DRIZZLE_DATABASE_URL, DATABASE_URL, DATABASE_DIRECT_URL');
  process.exit(1);
}

let parsedUrl;
try {
  parsedUrl = new URL(selectedUrl);
} catch {
  console.error(`[db:migrate] ${chosenEnvKey} is not a valid URL.`);
  process.exit(1);
}

const host = parsedUrl.hostname;
const port = parsedUrl.port || '(default)';
const username = decodeURIComponent(parsedUrl.username || '');
const password = decodeURIComponent(parsedUrl.password || '');

const hasPlaceholder = (value) =>
  /<|>|\[your-password\]|\[project-ref\]|%3c|%3e/i.test(value);

if (hasPlaceholder(username) || hasPlaceholder(password)) {
  console.error(`[db:migrate] ${chosenEnvKey} still contains placeholder values.`);
  console.error('[db:migrate] Example for Supabase pooler:');
  console.error(
    '  postgresql://postgres.<project_ref>:<db_password>@aws-1-us-east-1.pooler.supabase.com:6543/postgres'
  );
  process.exit(1);
}

if (host.includes('pooler.supabase.com') && username === 'postgres') {
  console.error('[db:migrate] Supabase pooler URLs require username format postgres.<project_ref>.');
  console.error('[db:migrate] You are currently using username "postgres".');
  process.exit(1);
}

const sql = postgres(selectedUrl, {
  ssl: 'require',
  prepare: false,
  max: 1,
  connect_timeout: 15,
});

try {
  const [result] = await sql`select current_database() as db, current_user as user`;
  console.log(
    `[db:migrate] Connection preflight passed via ${chosenEnvKey} -> ${host}:${port} as ${result.user}`
  );
} catch (error) {
  console.error('[db:migrate] Connection preflight failed.');
  if (error?.code === 'ENOTFOUND') {
    console.error(
      `[db:migrate] Host resolution failed for "${host}". If this is a direct URL, switch to the pooler URL on port 6543.`
    );
  } else if (String(error?.message || '').includes('Tenant or user not found')) {
    console.error(
      '[db:migrate] Supabase rejected tenant/user. Verify pooler username is postgres.<project_ref> and password is your DB password.'
    );
  } else if (String(error?.message || '').includes('password authentication failed')) {
    console.error('[db:migrate] Password authentication failed. Recheck your database password.');
  }
  console.error(error);
  process.exit(1);
} finally {
  await sql.end({ timeout: 5 });
}

const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const args = ['drizzle-kit', 'migrate'];
const child = spawn(command, args, {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`[db:migrate] drizzle-kit exited via signal ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});

child.on('error', (error) => {
  console.error('[db:migrate] Failed to start drizzle-kit migrate.');
  console.error(error);
  process.exit(1);
});
