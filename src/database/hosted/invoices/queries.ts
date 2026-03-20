import { getSupabaseClient } from '@/services/supabase-client';
import { byId, callHostedWriteRoute, requireHostedUserId, toNumber, toNumberOrNull, withHostedRead } from '@/database/hosted/shared/runtime';
import { listClients } from '@/database/hosted/clients-projects/queries';
import { hydrateSessions } from '@/database/hosted/sessions/queries';
import type {
  Invoice,
  InvoiceSessionLink,
  InvoiceSessionLinkMode,
  InvoiceType,
  InvoiceWithClient,
  MilestoneAmountType,
  MilestoneCompletionMode,
  Session,
} from '@/database/hosted/types';

export function createInvoice(input: {
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
  return callHostedWriteRoute('/api/db/invoices/create', {
    id: input.id,
    clientId: input.client_id,
    total: input.total,
    status: input.status,
    invoiceType: input.invoice_type,
    mercuryInvoiceId: input.mercury_invoice_id,
    paymentLink: input.payment_link,
    sourceProjectId: input.source_project_id,
    sourceProjectName: input.source_project_name,
    sourceMilestoneId: input.source_milestone_id,
    sourceMilestoneTitle: input.source_milestone_title,
    sourceMilestoneAmountType: input.source_milestone_amount_type,
    sourceMilestoneAmountValue: input.source_milestone_amount_value,
    sourceMilestoneCompletionMode: input.source_milestone_completion_mode,
    sourceMilestoneCompletedAt: input.source_milestone_completed_at,
    sourceSessionLinkMode: input.source_session_link_mode,
    sourceSessionHourlyRate: input.source_session_hourly_rate,
  });
}

export function listInvoices(): Promise<InvoiceWithClient[]> {
  return withHostedRead(async () => {
    const supabase = getSupabaseClient();
    const userId = await requireHostedUserId();
    const [clientsData, invoicesResult] = await Promise.all([
      listClients(),
      supabase
        .from('invoices')
        .select(
          `id,client_id,total,status,invoice_type,mercury_invoice_id,payment_link,source_project_id,
             source_project_name,source_milestone_id,source_milestone_title,source_milestone_amount_type,
             source_milestone_amount_value,source_milestone_completion_mode,source_milestone_completed_at,
             source_session_link_mode,source_session_hourly_rate,created_at,updated_at,deleted_at`,
        )
        .eq('auth_user_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
    ]);

    if (invoicesResult.error) {
      throw new Error(invoicesResult.error.message);
    }

    const clientsById = byId(clientsData);
    const rows = (invoicesResult.data ?? []) as Array<Record<string, unknown>>;
    return rows.map((row) => {
      const client = clientsById.get(String(row.client_id));
      return {
        id: String(row.id),
        client_id: String(row.client_id),
        total: toNumber(row.total),
        status: (row.status as Invoice['status']) ?? 'draft',
        invoice_type: (row.invoice_type as InvoiceType) ?? 'hourly',
        mercury_invoice_id: (row.mercury_invoice_id as string | null) ?? null,
        payment_link: (row.payment_link as string | null) ?? null,
        source_project_id: (row.source_project_id as string | null) ?? null,
        source_project_name: (row.source_project_name as string | null) ?? null,
        source_milestone_id: (row.source_milestone_id as string | null) ?? null,
        source_milestone_title: (row.source_milestone_title as string | null) ?? null,
        source_milestone_amount_type:
          (row.source_milestone_amount_type as MilestoneAmountType | null) ?? null,
        source_milestone_amount_value: toNumberOrNull(row.source_milestone_amount_value),
        source_milestone_completion_mode:
          (row.source_milestone_completion_mode as MilestoneCompletionMode | null) ?? null,
        source_milestone_completed_at: (row.source_milestone_completed_at as string | null) ?? null,
        source_session_link_mode:
          (row.source_session_link_mode as InvoiceSessionLinkMode | null) ?? null,
        source_session_hourly_rate: toNumberOrNull(row.source_session_hourly_rate),
        created_at: String(row.created_at),
        updated_at: String(row.updated_at),
        deleted_at: (row.deleted_at as string | null) ?? null,
        client_name: client?.name ?? null,
        client_email: client?.email ?? null,
        client_phone: client?.phone ?? null,
        client_hourly_rate: client?.hourly_rate ?? null,
      };
    });
  });
}

export function listSessionsByInvoiceId(invoiceId: string): Promise<Session[]> {
  return withHostedRead(async () => {
    const supabase = getSupabaseClient();
    const userId = await requireHostedUserId();
    const [directResult, links] = await Promise.all([
      supabase
        .from('sessions')
        .select(
          'id,client,client_id,project_id,task_id,start_time,end_time,duration,notes,commit_sha,invoice_id,created_at,updated_at,deleted_at',
        )
        .eq('auth_user_id', userId)
        .eq('invoice_id', invoiceId)
        .is('deleted_at', null),
      listInvoiceSessionLinksByInvoiceId(invoiceId),
    ]);

    if (directResult.error) {
      throw new Error(directResult.error.message);
    }

    const linkedSessionIds = links.map((link) => link.session_id);
    let linkedRows: Array<Record<string, unknown>> = [];
    if (linkedSessionIds.length > 0) {
      const linkedResult = await supabase
        .from('sessions')
        .select(
          'id,client,client_id,project_id,task_id,start_time,end_time,duration,notes,commit_sha,invoice_id,created_at,updated_at,deleted_at',
        )
        .eq('auth_user_id', userId)
        .in('id', linkedSessionIds)
        .is('deleted_at', null);

      if (linkedResult.error) {
        throw new Error(linkedResult.error.message);
      }
      linkedRows = (linkedResult.data ?? []) as Array<Record<string, unknown>>;
    }

    const allRows = [...((directResult.data ?? []) as Array<Record<string, unknown>>), ...linkedRows];
    const deduped = new Map(allRows.map((row) => [String(row.id), row]));
    const hydrated = await hydrateSessions([...deduped.values()], userId);
    return hydrated.sort((a, b) => a.start_time.localeCompare(b.start_time));
  });
}

export function assignSessionsToInvoice(sessionIds: string[], invoiceId: string): Promise<void> {
  return callHostedWriteRoute('/api/db/invoices/assign-sessions', {
    sessionIds,
    invoiceId,
  });
}

export function createInvoiceSessionLinks(input: {
  invoiceId: string;
  sessionIds: string[];
  linkMode: InvoiceSessionLinkMode;
}): Promise<void> {
  return callHostedWriteRoute('/api/db/invoice-session-links/upsert', {
    invoiceId: input.invoiceId,
    sessionIds: input.sessionIds,
    linkMode: input.linkMode,
  });
}

export function listInvoiceSessionLinksByInvoiceId(
  invoiceId: string,
): Promise<InvoiceSessionLink[]> {
  return withHostedRead(async () => {
    const supabase = getSupabaseClient();
    const userId = await requireHostedUserId();
    const { data, error } = await supabase
      .from('invoice_session_links')
      .select('id,invoice_id,session_id,link_mode,created_at,updated_at')
      .eq('auth_user_id', userId)
      .eq('invoice_id', invoiceId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      id: String(row.id),
      invoice_id: String(row.invoice_id),
      session_id: String(row.session_id),
      link_mode: (row.link_mode as InvoiceSessionLinkMode) ?? 'context',
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
    }));
  });
}
