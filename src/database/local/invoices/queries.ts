import type {
  Invoice,
  InvoiceSessionLink,
  InvoiceSessionLinkMode,
  InvoiceType,
  InvoiceWithClient,
  MilestoneAmountType,
  MilestoneCompletionMode,
  Session,
} from '@/database/types';
import { assertDbInvoiceTotal, createDbId, getDb, nowIso } from '@/database/local/shared/runtime';

export async function createInvoice(input: {
  id: string;
  client_id: string;
  total: number;
  status?: Invoice['status'];
  invoice_type?: InvoiceType;
  mercury_invoice_id?: string | null;
  payment_link?: string | null;
  source_project_id?: string | null;
  source_project_name?: string | null;
  source_milestone_id?: string | null;
  source_milestone_title?: string | null;
  source_milestone_amount_type?: MilestoneAmountType | null;
  source_milestone_amount_value?: number | null;
  source_milestone_completion_mode?: MilestoneCompletionMode | null;
  source_milestone_completed_at?: string | null;
  source_session_link_mode?: InvoiceSessionLinkMode | null;
  source_session_hourly_rate?: number | null;
}): Promise<void> {
  const db = await getDb();
  const timestamp = nowIso();
  assertDbInvoiceTotal(input.total);

  await db.runAsync(
    `INSERT INTO invoices (
      id,
      client_id,
      total,
      status,
      invoice_type,
      mercury_invoice_id,
      payment_link,
      source_project_id,
      source_project_name,
      source_milestone_id,
      source_milestone_title,
      source_milestone_amount_type,
      source_milestone_amount_value,
      source_milestone_completion_mode,
      source_milestone_completed_at,
      source_session_link_mode,
      source_session_hourly_rate,
      created_at,
      updated_at,
      deleted_at
    )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    input.id,
    input.client_id,
    input.total,
    input.status ?? 'draft',
    input.invoice_type ?? 'hourly',
    input.mercury_invoice_id ?? null,
    input.payment_link ?? null,
    input.source_project_id ?? null,
    input.source_project_name ?? null,
    input.source_milestone_id ?? null,
    input.source_milestone_title ?? null,
    input.source_milestone_amount_type ?? null,
    input.source_milestone_amount_value ?? null,
    input.source_milestone_completion_mode ?? null,
    input.source_milestone_completed_at ?? null,
    input.source_session_link_mode ?? null,
    input.source_session_hourly_rate ?? null,
    timestamp,
    timestamp,
  );
}

export async function listInvoices(): Promise<InvoiceWithClient[]> {
  const db = await getDb();
  return db.getAllAsync<InvoiceWithClient>(
    `SELECT
       i.id,
       i.client_id,
       i.total,
       i.status,
       i.invoice_type,
       i.mercury_invoice_id,
       i.payment_link,
       i.source_project_id,
       i.source_project_name,
       i.source_milestone_id,
       i.source_milestone_title,
       i.source_milestone_amount_type,
       i.source_milestone_amount_value,
       i.source_milestone_completion_mode,
       i.source_milestone_completed_at,
       i.source_session_link_mode,
       i.source_session_hourly_rate,
       i.created_at,
       i.updated_at,
       i.deleted_at,
       c.name AS client_name,
       c.email AS client_email,
       c.phone AS client_phone,
       c.hourly_rate AS client_hourly_rate
     FROM invoices i
     LEFT JOIN clients c ON c.id = i.client_id
     WHERE i.deleted_at IS NULL
     ORDER BY i.created_at DESC`,
  );
}

export async function listSessionsByInvoiceId(invoiceId: string): Promise<Session[]> {
  const db = await getDb();
  return db.getAllAsync<Session>(
    `SELECT
       s.id,
       s.client,
       s.client_id,
       s.project_id,
       s.task_id,
       c.name AS client_name,
       p.name AS project_name,
       t.name AS task_name,
       c.github_org AS github_org,
       p.github_repo AS github_repo,
       t.github_branch AS github_branch,
       (
         SELECT COUNT(*)
           FROM session_breaks sb
          WHERE sb.session_id = s.id
            AND sb.deleted_at IS NULL
       ) AS break_count,
       EXISTS (
         SELECT 1
           FROM session_breaks sb
          WHERE sb.session_id = s.id
            AND sb.deleted_at IS NULL
            AND sb.end_time IS NULL
       ) AS is_paused,
       s.start_time,
       s.end_time,
       s.duration,
       s.notes,
       s.commit_sha,
       CASE
         WHEN s.commit_sha IS NOT NULL
           AND c.github_org IS NOT NULL
           AND p.github_repo IS NOT NULL
         THEN 'https://github.com/' || c.github_org || '/' || p.github_repo || '/commit/' || s.commit_sha
         ELSE NULL
       END AS commit_url,
       s.invoice_id,
       s.created_at,
       s.updated_at,
       s.deleted_at
     FROM sessions s
     LEFT JOIN clients c ON c.id = s.client_id
     LEFT JOIN projects p ON p.id = s.project_id
     LEFT JOIN tasks t ON t.id = s.task_id
     WHERE s.deleted_at IS NULL
       AND (
         s.invoice_id = ?
         OR EXISTS (
           SELECT 1
           FROM invoice_session_links isl
           WHERE isl.invoice_id = ?
             AND isl.session_id = s.id
         )
       )
     ORDER BY s.start_time ASC`,
    invoiceId,
    invoiceId,
  );
}

export async function assignSessionsToInvoice(sessionIds: string[], invoiceId: string): Promise<void> {
  if (sessionIds.length === 0) {
    return;
  }

  const db = await getDb();
  const placeholders = sessionIds.map(() => '?').join(',');

  await db.runAsync(
    `UPDATE sessions
       SET invoice_id = ?, updated_at = ?
     WHERE id IN (${placeholders})`,
    invoiceId,
    nowIso(),
    ...sessionIds,
  );
}

export async function createInvoiceSessionLinks(input: {
  invoiceId: string;
  sessionIds: string[];
  linkMode: InvoiceSessionLinkMode;
}): Promise<void> {
  if (input.sessionIds.length === 0) {
    return;
  }
  if (input.linkMode !== 'context' && input.linkMode !== 'billed') {
    throw new Error('Invalid invoice session link mode.');
  }

  const db = await getDb();
  const timestamp = nowIso();
  for (const sessionId of input.sessionIds) {
    await db.runAsync(
      `INSERT OR REPLACE INTO invoice_session_links (
        id,
        invoice_id,
        session_id,
        link_mode,
        created_at,
        updated_at
      )
       VALUES (?, ?, ?, ?, ?, ?)`,
      createDbId('invoice_session_link'),
      input.invoiceId,
      sessionId,
      input.linkMode,
      timestamp,
      timestamp,
    );
  }
}

export async function listInvoiceSessionLinksByInvoiceId(
  invoiceId: string,
): Promise<InvoiceSessionLink[]> {
  const db = await getDb();
  return db.getAllAsync<InvoiceSessionLink>(
    `SELECT
       id,
       invoice_id,
       session_id,
       link_mode,
       created_at,
       updated_at
     FROM invoice_session_links
     WHERE invoice_id = ?
     ORDER BY created_at ASC`,
    invoiceId,
  );
}
