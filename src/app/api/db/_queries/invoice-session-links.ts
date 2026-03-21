import { sql } from 'drizzle-orm';
import type { WriteDb } from '@/app/api/db/_shared/db';
import { conflict, notFound } from '@/app/api/db/_shared/errors';
import { makeEphemeralId, nowIso } from '@/app/api/db/_shared/parsers';

export type UpsertInvoiceSessionLinksInput = {
  invoiceId: string;
  sessionIds: string[];
  linkMode: 'context' | 'billed';
};

export async function upsertInvoiceSessionLinks(
  db: WriteDb,
  authUserId: string,
  input: UpsertInvoiceSessionLinksInput,
): Promise<void> {
  const invoiceResult = await db.execute(sql`
    select id
    from invoices
    where id = ${input.invoiceId}
      and auth_user_id = ${authUserId}::uuid
      and deleted_at is null
    limit 1
  `);
  const invoiceRows = Array.isArray(invoiceResult)
    ? invoiceResult
    : ((invoiceResult as { rows?: unknown[] }).rows ?? []);
  if (invoiceRows.length === 0) {
    throw notFound('Invoice not found.');
  }

  const sessionRowsResult = await db.execute(sql`
    select id
    from sessions
    where auth_user_id = ${authUserId}::uuid
      and id = any(${input.sessionIds}::text[])
      and deleted_at is null
  `);
  const sessionRows = Array.isArray(sessionRowsResult)
    ? sessionRowsResult
    : ((sessionRowsResult as { rows?: unknown[] }).rows ?? []);
  if (sessionRows.length !== input.sessionIds.length) {
    throw conflict('One or more sessions were not found or are deleted.');
  }

  const timestamp = nowIso();
  await db.transaction(async (tx) => {
    for (const sessionId of input.sessionIds) {
      await tx.execute(sql`
        insert into invoice_session_links (
          id, auth_user_id, invoice_id, session_id, link_mode, created_at, updated_at
        ) values (
          ${makeEphemeralId('invoice_session_link')},
          ${authUserId}::uuid,
          ${input.invoiceId},
          ${sessionId},
          ${input.linkMode},
          ${timestamp},
          ${timestamp}
        )
        on conflict (invoice_id, session_id, auth_user_id) do update
        set link_mode = ${input.linkMode}, updated_at = ${timestamp}
      `);
    }
  });
}
