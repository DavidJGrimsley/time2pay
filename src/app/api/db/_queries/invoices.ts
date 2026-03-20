import { sql } from 'drizzle-orm';
import type { WriteDb } from '@/app/api/db/_shared/db';
import { nowIso } from '@/app/api/db/_shared/parsers';

export type CreateInvoiceInput = {
  id: string;
  clientId: string;
  total: number;
  status?: 'draft' | 'sent' | 'paid' | 'overdue';
  invoiceType?: 'hourly' | 'milestone';
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
      ${String(input.total)},
      ${input.status ?? 'draft'},
      ${input.invoiceType ?? 'hourly'},
      ${input.mercuryInvoiceId ?? null},
      ${input.paymentLink ?? null},
      ${input.sourceProjectId ?? null},
      ${input.sourceProjectName ?? null},
      ${input.sourceMilestoneId ?? null},
      ${input.sourceMilestoneTitle ?? null},
      ${input.sourceMilestoneAmountType ?? null},
      ${input.sourceMilestoneAmountValue === null || input.sourceMilestoneAmountValue === undefined
        ? null
        : String(input.sourceMilestoneAmountValue)},
      ${input.sourceMilestoneCompletionMode ?? null},
      ${input.sourceMilestoneCompletedAt ?? null},
      ${input.sourceSessionLinkMode ?? null},
      ${input.sourceSessionHourlyRate === null || input.sourceSessionHourlyRate === undefined
        ? null
        : String(input.sourceSessionHourlyRate)},
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

export async function assignSessionsToInvoice(
  db: WriteDb,
  authUserId: string,
  input: AssignSessionsToInvoiceInput,
): Promise<void> {
  if (input.sessionIds.length === 0) {
    return;
  }
  const timestamp = nowIso();
  await db.execute(sql`
    update sessions
    set invoice_id = ${input.invoiceId}, updated_at = ${timestamp}
    where auth_user_id = ${authUserId}::uuid
      and id = any(${input.sessionIds}::text[])
  `);
}
