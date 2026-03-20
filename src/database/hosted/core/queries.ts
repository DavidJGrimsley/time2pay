import type { SQLiteDatabase } from 'expo-sqlite';
import { ensureHostedProfileRow, requireHostedUserId } from '@/database/hosted/shared/runtime';
import type { CoreDbValidationReport } from '@/database/hosted/types';

export async function getDb(): Promise<SQLiteDatabase> {
  throw new Error('getDb is only available in local SQLite mode.');
}

export async function initializeDatabase(): Promise<void> {
  const userId = await requireHostedUserId();
  await ensureHostedProfileRow(userId);
}

export async function getCurrentSchemaVersion(): Promise<number> {
  return 1;
}

export async function runCoreDbValidationScript(): Promise<CoreDbValidationReport> {
  throw new Error('Core DB validation script is only available in local SQLite mode.');
}
