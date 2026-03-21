import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/database/hosted/schema';

export type WriteDb = PostgresJsDatabase<typeof schema>;

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_DIRECT_URL?.trim() ?? process.env.DATABASE_URL?.trim() ?? '';
  if (!url) {
    throw new Error('DATABASE_DIRECT_URL or DATABASE_URL is required for hosted write routes.');
  }

  return url;
}

let writeClient: postgres.Sql | null = null;
let writeDb: WriteDb | null = null;

function getWriteDb(): WriteDb {
  if (writeDb) {
    return writeDb;
  }

  writeClient = postgres(getDatabaseUrl(), { prepare: false });
  writeDb = drizzle(writeClient, { schema });
  return writeDb;
}

export async function withWriteDb<T>(work: (db: WriteDb) => Promise<T>): Promise<T> {
  return work(getWriteDb());
}
