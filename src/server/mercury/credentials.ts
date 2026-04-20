import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { createMercuryClient } from '@mr.dj2u/mercury';
import { withWriteDb, type WriteDb } from '@/server/db/_shared/db';

const MERCURY_CREDENTIAL_UNAVAILABLE_MESSAGE = 'No Mercury API key is saved for this account.';

export type MercuryCredentialStatus = {
  configured: boolean;
  keyLastFour: string | null;
  updatedAt: string | null;
};

type CredentialSecretRow = {
  encrypted_api_key?: string | null;
  iv?: string | null;
  auth_tag?: string | null;
  key_last_four?: string | null;
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

function getEncryptionKey(): Buffer {
  const secret = process.env.MERCURY_API_KEY_ENCRYPTION_SECRET?.trim() ?? '';
  if (!secret) {
    throw new Error('Missing MERCURY_API_KEY_ENCRYPTION_SECRET environment variable.');
  }

  return createHash('sha256').update(secret).digest();
}

function encryptApiKey(apiKey: string): {
  encryptedApiKey: string;
  iv: string;
  authTag: string;
} {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(apiKey, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encryptedApiKey: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

function decryptApiKey(row: CredentialSecretRow): string {
  if (!row.encrypted_api_key || !row.iv || !row.auth_tag) {
    throw new Error(MERCURY_CREDENTIAL_UNAVAILABLE_MESSAGE);
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(row.iv, 'base64'),
  );
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
): Promise<CredentialSecretRow | null> {
  const result = await db.execute(sql`
    select encrypted_api_key, iv, auth_tag, key_last_four, updated_at
    from mercury_credentials
    where auth_user_id = ${authUserId}::uuid
      and deleted_at is null
      and encrypted_api_key is not null
      and iv is not null
      and auth_tag is not null
    limit 1
  `);

  return (rowsFromResult(result)[0] as CredentialSecretRow | undefined) ?? null;
}

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
      };
    }

    return {
      configured: true,
      keyLastFour: row.key_last_four ?? null,
      updatedAt: toIsoString(row.updated_at),
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
  if (/mercury_sandbox/i.test(apiKey)) {
    throw new Error('Save a production Mercury API key. Sandbox keys are only used in tour mode.');
  }

  const encrypted = encryptApiKey(apiKey);
  const timestamp = new Date().toISOString();
  const keyLastFour = apiKey.slice(-4);

  await withWriteDb(async (db) => {
    await ensureProfileRow(db, authUserId);
    await db.execute(sql`
      insert into mercury_credentials (
        auth_user_id, encrypted_api_key, iv, auth_tag, key_last_four, created_at, updated_at, deleted_at
      ) values (
        ${authUserId}::uuid,
        ${encrypted.encryptedApiKey},
        ${encrypted.iv},
        ${encrypted.authTag},
        ${keyLastFour},
        ${timestamp},
        ${timestamp},
        null
      )
      on conflict (auth_user_id) do update set
        encrypted_api_key = excluded.encrypted_api_key,
        iv = excluded.iv,
        auth_tag = excluded.auth_tag,
        key_last_four = excluded.key_last_four,
        updated_at = excluded.updated_at,
        deleted_at = null
    `);
  });

  return {
    configured: true,
    keyLastFour,
    updatedAt: timestamp,
  };
}

export async function deleteMercuryCredentialForUser(authUserId: string): Promise<void> {
  const timestamp = new Date().toISOString();
  await withWriteDb(async (db) => {
    await db.execute(sql`
      update mercury_credentials
      set
        encrypted_api_key = null,
        iv = null,
        auth_tag = null,
        key_last_four = null,
        deleted_at = ${timestamp},
        updated_at = ${timestamp}
      where auth_user_id = ${authUserId}::uuid
        and deleted_at is null
    `);
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

    return decryptApiKey(row);
  });
}

export async function testMercuryCredentialForUser(authUserId: string): Promise<void> {
  const apiKey = await getDecryptedMercuryApiKeyForUser(authUserId);
  if (!apiKey) {
    throw new Error(MERCURY_CREDENTIAL_UNAVAILABLE_MESSAGE);
  }

  const client = createMercuryClient({
    apiKey,
    environment: 'production',
    baseUrl: process.env.MERCURY_BASE_URL?.trim() || undefined,
  });

  await client.accounts.list({ limit: 1 });
}
