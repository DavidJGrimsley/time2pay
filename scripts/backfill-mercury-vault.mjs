import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';
import { createRequire } from 'node:module';
import postgres from 'postgres';

const require = createRequire(import.meta.url);
const { loadFirstEnvFile } = require('./env-loader.cjs');

loadFirstEnvFile({ cwd: process.cwd(), prefix: '[mercury-vault-backfill]' });

const URL_PRECEDENCE = ['DATABASE_DIRECT_URL', 'DATABASE_URL'];
const chosenEnvKey = URL_PRECEDENCE.find((key) => process.env[key]?.trim());
const selectedUrl = chosenEnvKey ? process.env[chosenEnvKey].trim() : '';

if (!selectedUrl) {
  console.error('[mercury-vault-backfill] Missing DATABASE_URL / DATABASE_DIRECT_URL.');
  process.exit(1);
}

const legacySecret = process.env.MERCURY_API_KEY_ENCRYPTION_SECRET?.trim() ?? '';
if (!legacySecret) {
  console.error(
    '[mercury-vault-backfill] MERCURY_API_KEY_ENCRYPTION_SECRET is required to decrypt legacy rows.',
  );
  process.exit(1);
}

const legacyKey = crypto.createHash('sha256').update(legacySecret).digest();

function decryptLegacy(row) {
  if (!row.encrypted_api_key || !row.iv || !row.auth_tag) {
    return null;
  }
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    legacyKey,
    Buffer.from(row.iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(row.auth_tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(row.encrypted_api_key, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

const sqlClient = postgres(selectedUrl, {
  ssl: 'require',
  prepare: false,
  max: 1,
  connect_timeout: 15,
});

try {
  const rows = await sqlClient`
    select auth_user_id, encrypted_api_key, iv, auth_tag
    from mercury_credentials
    where deleted_at is null
      and vault_secret_id is null
      and encrypted_api_key is not null
      and iv is not null
      and auth_tag is not null
  `;

  if (rows.length === 0) {
    console.log('[mercury-vault-backfill] No legacy rows to migrate. Done.');
    process.exit(0);
  }

  console.log(`[mercury-vault-backfill] Migrating ${rows.length} legacy row(s) to Vault.`);

  let migrated = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      const apiKey = decryptLegacy(row);
      if (!apiKey) {
        console.warn(
          `[mercury-vault-backfill] Skipping ${row.auth_user_id}: decryption produced empty key.`,
        );
        failed += 1;
        continue;
      }

      const [{ id }] = await sqlClient`
        select vault.create_secret(${apiKey}, null, 'Mercury API key (time2pay, backfilled)') as id
      `;

      await sqlClient`
        update mercury_credentials
        set
          vault_secret_id = ${id}::uuid,
          encrypted_api_key = null,
          iv = null,
          auth_tag = null
        where auth_user_id = ${row.auth_user_id}::uuid
      `;
      migrated += 1;
      console.log(`[mercury-vault-backfill] Migrated user=${row.auth_user_id} secret=${id}`);
    } catch (error) {
      failed += 1;
      console.error(
        `[mercury-vault-backfill] Failed for ${row.auth_user_id}:`,
        error?.message || error,
      );
    }
  }

  console.log(
    `[mercury-vault-backfill] Done. migrated=${migrated} failed=${failed}.`,
  );
} catch (error) {
  console.error('[mercury-vault-backfill] Backfill failed.');
  console.error(error);
  process.exit(1);
} finally {
  await sqlClient.end({ timeout: 5 });
}
