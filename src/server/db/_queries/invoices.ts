import { sql } from 'drizzle-orm';
import type { WriteDb } from '@/server/db/_shared/db';
import { conflict, notFound, validation } from '@/server/db/_shared/errors';
import { toNumericString } from '@/server/db/_queries/_shared';
import { nowIso } from '@/server/db/_shared/parsers';

export type CreateInvoiceInput = {
  id: string;
  clientId: string;
  total: number;
  status?: 'draft' | 'sent' | 'paid' | 'overdue';
  invoiceType?: 'hourly' | 'milestone' | 'combined';
  mercuryInvoiceId?: string | null;
  paymentLink?: string | null;
  sourceProjectId?: string | null;
  sourceProjectName?: string | null;
  sourceMilestoneId?: string | null;
  sourceMilestoneTitle?: string | null;
  sourceMilestoneAmountType?: 'percent' | 'fixed' | null;
  sourceMilestoneAmountValue?: number | null;
  sourceMilestoneCompletionMode?: 'toggle' | 'checklist' | null;
  sourceMilestoneCompletedAt?: string | null;
  sourceSessionLinkMode?: 'context' | 'billed' | null;
  sourceSessionHourlyRate?: number | null;
};

export async function createInvoice(
  db: WriteDb,
  authUserId: string,
  input: CreateInvoiceInput,
): Promise<void> {
  if (!input.id.trim() || !input.clientId.trim()) {
    throw validation('Invoice id and client id are required.');
  }
  if (!Number.isFinite(input.total) || input.total < 0) {
    throw validation('Invoice total must be a non-negative number.');
  }

  const clientResult = await db.execute(sql`
    select id
    from clients
    where id = ${input.clientId}
      and auth_user_id = ${authUserId}::uuid
      and deleted_at is null
    limit 1
  `);
  const clientRows = Array.isArray(clientResult)
    ? clientResult
    : ((clientResult as { rows?: unknown[] }).rows ?? []);
  if (clientRows.length === 0) {
    throw notFound('Client not found.');
  }

  const timestamp = nowIso();
  await db.execute(sql`
    insert into invoices (
      id, auth_user_id, client_id, total, status, invoice_type, mercury_invoice_id, payment_link,
      source_project_id, source_project_name, source_milestone_id, source_milestone_title,
      source_milestone_amount_type, source_milestone_amount_value,
      source_milestone_completion_mode, source_milestone_completed_at, source_session_link_mode,
      source_session_hourly_rate, created_at, updated_at, deleted_at
    ) values (
      ${input.id},
      ${authUserId}::uuid,
      ${input.clientId},
      ${toNumericString(input.total)},
      ${input.status ?? 'draft'},
      ${input.invoiceType ?? 'hourly'},
      ${input.mercuryInvoiceId ?? null},
      ${input.paymentLink ?? null},
      ${input.sourceProjectId ?? null},
      ${input.sourceProjectName ?? null},
      ${input.sourceMilestoneId ?? null},
      ${input.sourceMilestoneTitle ?? null},
      ${input.sourceMilestoneAmountType ?? null},
      ${toNumericString(input.sourceMilestoneAmountValue)},
      ${input.sourceMilestoneCompletionMode ?? null},
      ${input.sourceMilestoneCompletedAt ?? null},
      ${input.sourceSessionLinkMode ?? null},
      ${toNumericString(input.sourceSessionHourlyRate)},
      ${timestamp},
      ${timestamp},
      null
    )
  `);
}

export type AssignSessionsToInvoiceInput = {
  invoiceId: string;
  sessionIds: string[];
};

export type DeleteInvoiceInput = {
  invoiceId: string;
};

export async function assignSessionsToInvoice(
  db: WriteDb,
  authUserId: string,
  input: AssignSessionsToInvoiceInput,
): Promise<void> {
  if (input.sessionIds.length === 0) {
    return;
  }
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

  const sessionIdArray = input.sessionIds;
  const sessionIdList = sql.join(
    sessionIdArray.map((sessionId) => sql`${sessionId}`),
    sql`, `,
  );
  const sessionResult = await db.execute(sql`
    select id
    from sessions
    where auth_user_id = ${authUserId}::uuid
      and id in (${sessionIdList})
      and deleted_at is null
  `);
  const sessionRows = Array.isArray(sessionResult)
    ? sessionResult
    : ((sessionResult as { rows?: unknown[] }).rows ?? []);
  if (sessionRows.length !== sessionIdArray.length) {
    throw conflict('One or more sessions do not exist or are deleted.');
  }

  const timestamp = nowIso();
  const updateResult = await db.execute(sql`
    update sessions
    set invoice_id = ${input.invoiceId}, updated_at = ${timestamp}
    where auth_user_id = ${authUserId}::uuid
      and id in (${sessionIdList})
      and deleted_at is null
    returning id
  `);
  const updatedRows = Array.isArray(updateResult)
    ? updateResult
    : ((updateResult as { rows?: unknown[] }).rows ?? []);
  if (updatedRows.length !== input.sessionIds.length) {
    throw conflict('Failed to assign every requested session to the invoice.');
  }
}

export async function deleteInvoice(
  db: WriteDb,
  authUserId: string,
  input: DeleteInvoiceInput,
): Promise<void> {
  if (!input.invoiceId.trim()) {
    throw validation('Invoice id is required.');
  }

  const invoiceResult = await db.execute(sql`
    select id, mercury_invoice_id, status
    from invoices
    where id = ${input.invoiceId}
      and auth_user_id = ${authUserId}::uuid
      and deleted_at is null
    limit 1
  `);
  const invoiceRows = Array.isArray(invoiceResult)
    ? invoiceResult
    : ((invoiceResult as { rows?: Array<{ mercury_invoice_id?: string | null; status?: string | null }> }).rows ??
        []);
  const invoice = invoiceRows[0];
  if (!invoice) {
    throw notFound('Invoice not found.');
  }
  if ((invoice.mercury_invoice_id ?? null) !== null) {
    throw conflict('Mercury-backed invoices must be reviewed in Mercury and cannot be deleted locally.');
  }
  if ((invoice.status ?? 'draft') !== 'draft') {
    throw conflict('Only draft invoices can be deleted.');
  }

  const timestamp = nowIso();
  await db.transaction(async (tx) => {
    await tx.execute(sql`
      update sessions
      set invoice_id = null, updated_at = ${timestamp}
      where auth_user_id = ${authUserId}::uuid
        and invoice_id = ${input.invoiceId}
        and deleted_at is null
    `);

    await tx.execute(sql`
      delete from invoice_session_links
      where auth_user_id = ${authUserId}::uuid
        and invoice_id = ${input.invoiceId}
    `);

    await tx.execute(sql`
      update invoice_milestone_links
      set deleted_at = ${timestamp}, updated_at = ${timestamp}
      where auth_user_id = ${authUserId}::uuid
        and invoice_id = ${input.invoiceId}
        and deleted_at is null
    `);

    const deleteResult = await tx.execute(sql`
      update invoices
      set deleted_at = ${timestamp}, updated_at = ${timestamp}
      where id = ${input.invoiceId}
        and auth_user_id = ${authUserId}::uuid
        and deleted_at is null
      returning id
    `);
    const deletedRows = Array.isArray(deleteResult)
      ? deleteResult
      : ((deleteResult as { rows?: unknown[] }).rows ?? []);
    if (deletedRows.length === 0) {
      throw notFound('Invoice not found.');
    }
  });
}
