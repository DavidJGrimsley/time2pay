import { sql } from 'drizzle-orm';
import type { WriteDb } from '@/app/api/db/_shared/db';
import { conflict, notFound, validation } from '@/app/api/db/_shared/errors';

type SqlExecutor = Pick<WriteDb, 'execute'>;

export function toNumericString(value: number | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (!Number.isFinite(value)) {
    throw validation('Expected a finite numeric value.');
  }
  return String(value);
}

function extractRows(result: unknown): unknown[] {
  if (Array.isArray(result)) {
    return result;
  }

  if (result && typeof result === 'object') {
    const rows = (result as { rows?: unknown[] }).rows;
    if (Array.isArray(rows)) {
      return rows;
    }
  }

  return [];
}

export async function assertUpdated(
  db: SqlExecutor,
  query: ReturnType<typeof sql>,
  failureMessage: string,
): Promise<void> {
  const result = await db.execute(query);
  if (extractRows(result).length === 0) {
    throw notFound(failureMessage);
  }
}

export async function assertInvoiceUnlocked(
  db: SqlExecutor,
  authUserId: string,
  sessionId: string,
): Promise<void> {
  const result = await db.execute(sql`
    select invoice_id
    from sessions
    where id = ${sessionId}
      and auth_user_id = ${authUserId}::uuid
      and deleted_at is null
    limit 1
  `);
  const rows = extractRows(result) as { invoice_id?: string | null }[];
  if (rows.length === 0) {
    throw notFound('Session not found.');
  }
  if ((rows[0]?.invoice_id ?? null) !== null) {
    throw conflict('Invoiced sessions are locked and cannot be edited.');
  }
}
