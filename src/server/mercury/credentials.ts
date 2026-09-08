/**
 * Mercury credential storage — server-only.
 *
 * Production keys are stored as Supabase Vault secrets (referenced by
 * `mercury_credentials.vault_secret_id`). Legacy AES-256-GCM rows
 * (`encrypted_api_key` + `iv` + `auth_tag`) are read transparently for
 * backward compatibility until `scripts/backfill-mercury-vault.ts` has
 * migrated every row.
 *
 * IMPORTANT: This module uses `node:crypto` and direct DB access; it must
 * never be imported from client code. It should only be called from
 * `+api.ts` route handlers.
 */
import { createDecipheriv, createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { createMercuryClient } from '@mr.dj2u/mercury';
import { withWriteDb, type WriteDb } from '@/server/db/_shared/db';
import { classifyMercuryError, recordMercuryCredentialEvent } from '@/server/mercury/audit';

const MERCURY_CREDENTIAL_UNAVAILABLE_MESSAGE = 'No Mercury API key is saved for this account.';
const MERCURY_PRODUCTION_TOKEN_PATTERN = /^secret-token:mercury_production_[A-Za-z0-9_-]+$/i;
const MERCURY_PRODUCTION_TOKEN_FORMAT_MESSAGE =
  'Save the complete Mercury production API token beginning with "secret-token:mercury_production_".';

export type MercuryCredentialStatus = {
  configured: boolean;
  keyLastFour: string | null;
  updatedAt: string | null;
  arAccessAvailable: boolean | null;
  arAccessVerifiedAt: string | null;
};

type CredentialRow = {
  vault_secret_id?: string | null;
  encrypted_api_key?: string | null;
  iv?: string | null;
  auth_tag?: string | null;
  key_last_four?: string | null;
  ar_access_available?: boolean | null;
  ar_access_verified_at?: string | Date | null;
  updated_at?: string | Date | null;
};

function rowsFromResult(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) {
    return result as Record<string, unknown>[];
  }
  if (result && typeof result === 'object') {
    const rows = (result as { rows?: unknown[] }).rows;
    if (Array.isArray(rows)) {
      return rows as Record<string, unknown>[];
    }
  }
  return [];
}

function getLegacyEncryptionKey(): Buffer | null {
  const secret = process.env.MERCURY_API_KEY_ENCRYPTION_SECRET?.trim() ?? '';
  if (!secret) {
    return null;
  }
  return createHash('sha256').update(secret).digest();
}

function decryptLegacyApiKey(row: CredentialRow): string {
  if (!row.encrypted_api_key || !row.iv || !row.auth_tag) {
    throw new Error(MERCURY_CREDENTIAL_UNAVAILABLE_MESSAGE);
  }
  const key = getLegacyEncryptionKey();
  if (!key) {
    throw new Error(
      'Missing MERCURY_API_KEY_ENCRYPTION_SECRET. Set it (legacy rows still depend on it) or run scripts/backfill-mercury-vault.ts to migrate to Vault.',
    );
  }

  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(row.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(row.auth_tag, 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(row.encrypted_api_key, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

function toIsoString(value: unknown): string | null {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  return null;
}

async function ensureProfileRow(db: WriteDb, authUserId: string): Promise<void> {
  await db.execute(sql`
    insert into user_profiles (auth_user_id)
    values (${authUserId}::uuid)
    on conflict (auth_user_id) do nothing
  `);
}

async function readActiveCredentialRow(
  db: WriteDb,
  authUserId: string,
): Promise<CredentialRow | null> {
  const result = await db.execute(sql`
    select
      vault_secret_id,
      encrypted_api_key,
      iv,
      auth_tag,
      key_last_four,
      ar_access_available,
      ar_access_verified_at,
      updated_at
    from mercury_credentials
    where auth_user_id = ${authUserId}::uuid
      and deleted_at is null
      and (
        vault_secret_id is not null
        or (encrypted_api_key is not null and iv is not null and auth_tag is not null)
      )
    limit 1
  `);

  return (rowsFromResult(result)[0] as CredentialRow | undefined) ?? null;
}

async function createVaultSecret(db: WriteDb, apiKey: string): Promise<string> {
  const result = await db.execute(sql`
    select vault.create_secret(${apiKey}, null, 'Mercury API key (time2pay)') as id
  `);
  const row = rowsFromResult(result)[0] as { id?: string } | undefined;
  if (!row?.id) {
    throw new Error('Failed to create Vault secret for Mercury API key.');
  }
  return row.id;
}

async function readVaultSecret(db: WriteDb, secretId: string): Promise<string | null> {
  const result = await db.execute(sql`
    select decrypted_secret
    from vault.decrypted_secrets
    where id = ${secretId}::uuid
    limit 1
  `);
  const row = rowsFromResult(result)[0] as { decrypted_secret?: string | null } | undefined;
  return row?.decrypted_secret ?? null;
}

// Mercury's API does not expose a reliable signal for plan tier — both
// `ar.*.list` and `ar.invoices.create({})` return 200/400 regardless of
// whether the account actually has the AR (Plus or higher) feature.
// `ar_access_available` is therefore controlled manually by the user via
// `setMercuryArAccessForUser` rather than auto-probed. The save flow
// leaves it at `null` and a profile toggle flips it on/off.

export async function getMercuryCredentialStatusForUser(
  authUserId: string,
): Promise<MercuryCredentialStatus> {
  return withWriteDb(async (db) => {
    const row = await readActiveCredentialRow(db, authUserId);
    if (!row) {
      return {
        configured: false,
        keyLastFour: null,
        updatedAt: null,
        arAccessAvailable: null,
        arAccessVerifiedAt: null,
      };
    }

    return {
      configured: true,
      keyLastFour: row.key_last_four ?? null,
      updatedAt: toIsoString(row.updated_at),
      arAccessAvailable: row.ar_access_available ?? null,
      arAccessVerifiedAt: toIsoString(row.ar_access_verified_at),
    };
  });
}

export async function saveMercuryCredentialForUser(
  authUserId: string,
  rawApiKey: string,
): Promise<MercuryCredentialStatus> {
  const apiKey = rawApiKey.trim();
  if (!apiKey) {
    throw new Error('Mercury API key is required.');
  }
  if (/mercury_(?:sandbox|test)/i.test(apiKey)) {
    throw new Error('Save a production Mercury API key. Sandbox keys are only used in tour mode.');
  }
  if (!MERCURY_PRODUCTION_TOKEN_PATTERN.test(apiKey)) {
    throw new Error(MERCURY_PRODUCTION_TOKEN_FORMAT_MESSAGE);
  }

  const keyLastFour = apiKey.slice(-4);
  const savedAt = new Date().toISOString();

  let probeSuccess = false;
  let probeErrorCode: string | null = null;
  try {
    const client = createMercuryClient({ apiKey, environment: 'production' });
    await client.accounts.list({ limit: 1 });
    probeSuccess = true;
  } catch (error) {
    probeErrorCode = classifyMercuryError(error);
    throw error;
  } finally {
    await withWriteDb((db) =>
      recordMercuryCredentialEvent(db, {
        authUserId,
        action: 'tested',
        keyLastFour,
        success: probeSuccess,
        errorCode: probeErrorCode,
      }),
    );
  }

  const status = await withWriteDb(async (db) => {
    await ensureProfileRow(db, authUserId);
    const existing = await readActiveCredentialRow(db, authUserId);
    const isRotation = Boolean(existing);
    // Preserve any pre-existing manual ar_access_available toggle across
    // a key rotation — replacing the key doesn't change the user's plan.
    const preservedArAccessAvailable = existing?.ar_access_available ?? null;
    const preservedArAccessVerifiedAt =
      typeof existing?.ar_access_verified_at === 'string'
        ? existing.ar_access_verified_at
        : existing?.ar_access_verified_at instanceof Date
          ? existing.ar_access_verified_at.toISOString()
          : null;

    if (existing?.vault_secret_id) {
      await db.execute(sql`
        insert into mercury_credential_history (
          auth_user_id, vault_secret_id, key_last_four, retired_reason
        ) values (
          ${authUserId}::uuid,
          ${existing.vault_secret_id}::uuid,
          ${existing.key_last_four ?? null},
          'rotated'
        )
      `);
    } else if (existing && (existing.encrypted_api_key || existing.iv || existing.auth_tag)) {
      await db.execute(sql`
        insert into mercury_credential_history (
          auth_user_id, vault_secret_id, key_last_four, retired_reason
        ) values (
          ${authUserId}::uuid,
          null,
          ${existing.key_last_four ?? null},
          'rotated'
        )
      `);
    }

    const newSecretId = await createVaultSecret(db, apiKey);

    await db.execute(sql`
      insert into mercury_credentials (
        auth_user_id,
        vault_secret_id,
        encrypted_api_key,
        iv,
        auth_tag,
        key_last_four,
        ar_access_available,
        ar_access_verified_at,
        deleted_at
      ) values (
        ${authUserId}::uuid,
        ${newSecretId}::uuid,
        null,
        null,
        null,
        ${keyLastFour},
        ${preservedArAccessAvailable},
        ${preservedArAccessVerifiedAt}::timestamptz,
        null
      )
      on conflict (auth_user_id) do update set
        vault_secret_id = excluded.vault_secret_id,
        encrypted_api_key = null,
        iv = null,
        auth_tag = null,
        key_last_four = excluded.key_last_four,
        ar_access_available = excluded.ar_access_available,
        ar_access_verified_at = excluded.ar_access_verified_at,
        deleted_at = null
    `);

    await recordMercuryCredentialEvent(db, {
      authUserId,
      action: isRotation ? 'rotated' : 'created',
      keyLastFour,
    });

    return {
      configured: true,
      keyLastFour,
      updatedAt: savedAt,
      arAccessAvailable: preservedArAccessAvailable,
      arAccessVerifiedAt: preservedArAccessVerifiedAt,
    } satisfies MercuryCredentialStatus;
  });

  return status;
}

export async function deleteMercuryCredentialForUser(authUserId: string): Promise<void> {
  await withWriteDb(async (db) => {
    const existing = await readActiveCredentialRow(db, authUserId);

    if (existing) {
      await db.execute(sql`
        insert into mercury_credential_history (
          auth_user_id, vault_secret_id, key_last_four, retired_reason
        ) values (
          ${authUserId}::uuid,
          ${existing.vault_secret_id ?? null},
          ${existing.key_last_four ?? null},
          'deleted'
        )
      `);
    }

    const timestamp = new Date().toISOString();
    await db.execute(sql`
      update mercury_credentials
      set
        vault_secret_id = null,
        encrypted_api_key = null,
        iv = null,
        auth_tag = null,
        key_last_four = null,
        ar_access_available = null,
        ar_access_verified_at = null,
        deleted_at = ${timestamp}
      where auth_user_id = ${authUserId}::uuid
        and deleted_at is null
    `);

    await recordMercuryCredentialEvent(db, {
      authUserId,
      action: 'deleted',
      keyLastFour: existing?.key_last_four ?? null,
    });
  });
}

export async function getDecryptedMercuryApiKeyForUser(
  authUserId: string,
): Promise<string | null> {
  return withWriteDb(async (db) => {
    const row = await readActiveCredentialRow(db, authUserId);
    if (!row) {
      return null;
    }

    if (row.vault_secret_id) {
      const secret = await readVaultSecret(db, row.vault_secret_id);
      if (secret) {
        return secret;
      }
    }

    return decryptLegacyApiKey(row);
  });
}

export async function testMercuryCredentialForUser(authUserId: string): Promise<void> {
  const apiKey = await getDecryptedMercuryApiKeyForUser(authUserId);

  let lastFour: string | null = null;
  let success = false;
  let errorCode: string | null = null;

  try {
    if (!apiKey) {
      errorCode = 'no_credential';
      throw new Error(MERCURY_CREDENTIAL_UNAVAILABLE_MESSAGE);
    }

    lastFour = apiKey.slice(-4);
    if (!MERCURY_PRODUCTION_TOKEN_PATTERN.test(apiKey)) {
      errorCode = 'invalid_credential_format';
      throw new Error(MERCURY_PRODUCTION_TOKEN_FORMAT_MESSAGE);
    }

    const client = createMercuryClient({ apiKey, environment: 'production' });
    await client.accounts.list({ limit: 1 });
    success = true;
  } catch (error) {
    if (!errorCode) {
      errorCode = classifyMercuryError(error);
    }
    throw error;
  } finally {
    await withWriteDb((db) =>
      recordMercuryCredentialEvent(db, {
        authUserId,
        action: 'tested',
        keyLastFour: lastFour,
        success,
        errorCode,
      }),
    );
  }
}

export async function setMercuryArAccessForUser(
  authUserId: string,
  enabled: boolean,
): Promise<MercuryCredentialStatus> {
  const verifiedAt = new Date().toISOString();

  return withWriteDb(async (db) => {
    const existing = await readActiveCredentialRow(db, authUserId);
    if (!existing) {
      throw new Error(MERCURY_CREDENTIAL_UNAVAILABLE_MESSAGE);
    }

    await db.execute(sql`
      update mercury_credentials
      set
        ar_access_available = ${enabled},
        ar_access_verified_at = ${verifiedAt}::timestamptz
      where auth_user_id = ${authUserId}::uuid
        and deleted_at is null
    `);

    await recordMercuryCredentialEvent(db, {
      authUserId,
      action: 'ar_probed',
      keyLastFour: existing.key_last_four ?? null,
      success: enabled,
      errorCode: enabled ? null : 'user_disabled',
    });

    return {
      configured: true,
      keyLastFour: existing.key_last_four ?? null,
      updatedAt: toIsoString(existing.updated_at),
      arAccessAvailable: enabled,
      arAccessVerifiedAt: verifiedAt,
    };
  });
}
