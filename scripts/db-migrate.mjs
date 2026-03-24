import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

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
const databaseName = parsedUrl.pathname?.replace(/^\//, '') || '(none)';

const hasPlaceholder = (value) =>
  /<|>|\[your-password\]|\[project-ref\]|%3c|%3e/i.test(value);

function redactUrlForLogs(urlString) {
  try {
    const url = new URL(urlString);
    const redacted = new URL(urlString);
    redacted.password = url.password ? '***' : '';
    return redacted.toString();
  } catch {
    return '(invalid URL)';
  }
}

const isPooler = host.includes('pooler.supabase.com');
const isDirectSupabase = host.startsWith('db.') && host.endsWith('.supabase.co');

console.log(`[db:migrate] Using ${chosenEnvKey}`);
console.log(`[db:migrate] Target: ${host}:${port} db=${databaseName} user=${username || '(empty)'}`);
console.log(`[db:migrate] URL (redacted): ${redactUrlForLogs(selectedUrl)}`);

if (hasPlaceholder(username) || hasPlaceholder(password)) {
  console.error(`[db:migrate] ${chosenEnvKey} still contains placeholder values.`);
  if (hasPlaceholder(username)) {
    console.error('[db:migrate] Placeholder detected in USERNAME.');
  }
  if (hasPlaceholder(password)) {
    console.error('[db:migrate] Placeholder detected in PASSWORD.');
  }
  console.error('[db:migrate] Example for Supabase pooler:');
  console.error(
    '  postgresql://postgres.<project_ref>:<db_password>@aws-1-us-east-1.pooler.supabase.com:6543/postgres'
  );
  console.error('[db:migrate] Example for Supabase direct:');
  console.error(
    '  postgresql://postgres:<db_password>@db.<project_ref>.supabase.co:5432/postgres'
  );
  process.exit(1);
}

if (isPooler && username === 'postgres') {
  console.error('[db:migrate] Supabase pooler URLs require username format postgres.<project_ref>.');
  console.error('[db:migrate] You are currently using username "postgres".');
  process.exit(1);
}

if (isDirectSupabase && username.includes('.')) {
  console.error('[db:migrate] Direct Supabase URLs typically use username "postgres" (without .<project_ref>).');
  console.error(`[db:migrate] You are currently using username "${username}".`);
}

const migrationSql = postgres(selectedUrl, {
  ssl: 'require',
  prepare: false,
  max: 1,
  connect_timeout: 15,
});

const thisFileDir = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(thisFileDir, '..', 'drizzle', 'migrations');

function readLocalMigrationCount() {
  const journalPath = path.join(migrationsFolder, 'meta', '_journal.json');
  try {
    if (!fs.existsSync(journalPath)) {
      return null;
    }
    const raw = fs.readFileSync(journalPath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.entries) ? parsed.entries.length : null;
  } catch {
    return null;
  }
}

function readLatestLocalMigrationMeta() {
  const journalPath = path.join(migrationsFolder, 'meta', '_journal.json');
  try {
    if (!fs.existsSync(journalPath)) {
      return null;
    }
    const raw = fs.readFileSync(journalPath, 'utf8');
    const parsed = JSON.parse(raw);
    const entries = Array.isArray(parsed?.entries) ? parsed.entries : [];
    if (entries.length === 0) {
      return null;
    }

    const latest = [...entries].sort((a, b) => Number(a.when ?? 0) - Number(b.when ?? 0)).at(-1);
    if (!latest?.tag || !Number.isFinite(Number(latest.when))) {
      return null;
    }

    const sqlPath = path.join(migrationsFolder, `${latest.tag}.sql`);
    if (!fs.existsSync(sqlPath)) {
      return null;
    }

    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    const hash = crypto.createHash('sha256').update(sqlContent).digest('hex');
    return {
      tag: latest.tag,
      when: Number(latest.when),
      hash,
    };
  } catch {
    return null;
  }
}

async function readAppliedMigrationCount(sqlClient) {
  try {
    const [result] = await sqlClient`select count(*)::int as count from drizzle.__drizzle_migrations`;
    return Number(result?.count ?? 0);
  } catch {
    return null;
  }
}

try {
  const [result] = await migrationSql`select current_database() as db, current_user as user`;
  console.log(
    `[db:migrate] Connection preflight passed via ${chosenEnvKey} -> ${host}:${port} as ${result.user}`
  );

  const localMigrationCount = readLocalMigrationCount();
  const beforeAppliedCount = await readAppliedMigrationCount(migrationSql);
  const db = drizzle(migrationSql);

  console.log(
    `[db:migrate] Applying migrations from ${migrationsFolder} (${localMigrationCount ?? 'unknown'} local files).`
  );
  if (beforeAppliedCount !== null) {
    console.log(`[db:migrate] Previously applied migrations in DB: ${beforeAppliedCount}`);
  }

  await migrate(db, {
    migrationsFolder,
    migrationsSchema: 'drizzle',
    migrationsTable: '__drizzle_migrations',
  });

  const afterAppliedCount = await readAppliedMigrationCount(migrationSql);
  if (afterAppliedCount !== null) {
    console.log(`[db:migrate] Migration complete. Applied migrations in DB: ${afterAppliedCount}`);
  } else {
    console.log('[db:migrate] Migration complete.');
  }
} catch (error) {
  console.error('[db:migrate] Migration failed.');
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
  } else if (
    error?.cause?.code === '42P07' &&
    String(error?.cause?.message || '').toLowerCase().includes('already exists') &&
    String(error?.query || '').toUpperCase().startsWith('CREATE TABLE')
  ) {
    console.error(
      '[db:migrate] Tables already exist, but drizzle migration ledger appears out of sync.'
    );
    const latestMeta = readLatestLocalMigrationMeta();
    if (latestMeta) {
      console.error('[db:migrate] If this DB is correct and you want to mark baseline as applied:');
      console.error(
        `  INSERT INTO drizzle.__drizzle_migrations ("hash", "created_at") VALUES ('${latestMeta.hash}', ${latestMeta.when});`
      );
    } else {
      console.error(
        '[db:migrate] Could not read local migration metadata. Check drizzle/migrations/meta/_journal.json.'
      );
    }
  }
  console.error(error);
  process.exit(1);
} finally {
  await migrationSql.end({ timeout: 5 });
}
