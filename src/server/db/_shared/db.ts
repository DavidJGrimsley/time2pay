import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/database/hosted/schema';

export type WriteDb = PostgresJsDatabase<typeof schema>;

function getDatabaseUrls(): string[] {
  const candidates = [
    process.env.DRIZZLE_DATABASE_URL?.trim() ?? '',
    process.env.DATABASE_URL?.trim() ?? '',
    process.env.DATABASE_DIRECT_URL?.trim() ?? '',
  ].filter(Boolean);

  if (candidates.length === 0) {
    throw new Error(
      'DRIZZLE_DATABASE_URL, DATABASE_URL, or DATABASE_DIRECT_URL is required for hosted write routes.',
    );
  }

  return [...new Set(candidates)];
}

let writeClient: postgres.Sql | null = null;
let writeDb: WriteDb | null = null;
let activeDatabaseUrl: string | null = null;

function resetWriteDb(): void {
  if (writeClient && typeof writeClient.end === 'function') {
    writeClient.end({ timeout: 0 }).catch(() => undefined);
  }

  writeClient = null;
  writeDb = null;
  activeDatabaseUrl = null;
}

function getWriteDb(databaseUrl: string): WriteDb {
  if (writeDb && activeDatabaseUrl === databaseUrl) {
    return writeDb;
  }

  resetWriteDb();
  writeClient = postgres(databaseUrl, { prepare: false });
  writeDb = drizzle(writeClient, { schema });
  activeDatabaseUrl = databaseUrl;
  return writeDb;
}

function isRetryableConnectionError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const retryableError = error as Error & { code?: string; cause?: { code?: string } };
  const code =
    typeof retryableError.code === 'string'
      ? retryableError.code
      : typeof retryableError.cause?.code === 'string'
        ? retryableError.cause.code
        : '';

  return ['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'ENETUNREACH', 'EHOSTUNREACH'].includes(code);
}

export async function withWriteDb<T>(work: (db: WriteDb) => Promise<T>): Promise<T> {
  const databaseUrls = getDatabaseUrls();
  let lastError: unknown;

  for (const [index, databaseUrl] of databaseUrls.entries()) {
    try {
      return await work(getWriteDb(databaseUrl));
    } catch (error) {
      lastError = error;

      if (!isRetryableConnectionError(error) || index === databaseUrls.length - 1) {
        throw error;
      }

      resetWriteDb();
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Hosted write DB failed to initialize.');
}
