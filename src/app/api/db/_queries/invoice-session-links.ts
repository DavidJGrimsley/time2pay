import { sql } from 'drizzle-orm';
import type { WriteDb } from '@/app/api/db/_shared/db';
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
  const timestamp = nowIso();
  for (const sessionId of input.sessionIds) {
    await db.execute(sql`
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
}
