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

export async function withWriteDb<T>(work: (db: WriteDb) => Promise<T>): Promise<T> {
  const client = postgres(getDatabaseUrl(), { prepare: false });
  const db = drizzle(client, { schema });
  try {
    return await work(db);
  } finally {
    await client.end({ timeout: 5 });
  }
}
