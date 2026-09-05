import { z } from 'zod';
import { handleDbWrite } from '@/server/db/_shared/route';
import { assignSessionsToInvoice, createInvoice, deleteInvoice } from '@/server/db/_queries/invoices';
import { invoiceInsertSchema } from '@/database/hosted/invoices/schema';

const invoiceStatusSchema = z.enum(['draft', 'sent', 'paid', 'overdue']);
const invoiceTypeSchema = z.enum(['hourly', 'milestone', 'combined']);
const milestoneAmountTypeSchema = z.enum(['percent', 'fixed']);
const milestoneCompletionModeSchema = z.enum(['toggle', 'checklist']);
const invoiceSessionLinkModeSchema = z.enum(['context', 'billed']);

const createInvoiceSchema = invoiceInsertSchema
  .pick({
    id: true,
    clientId: true,
    total: true,
    status: true,
    invoiceType: true,
    mercuryInvoiceId: true,
    paymentLink: true,
    sourceProjectId: true,
    sourceProjectName: true,
    sourceMilestoneId: true,
    sourceMilestoneTitle: true,
    sourceMilestoneAmountType: true,
    sourceMilestoneAmountValue: true,
    sourceMilestoneCompletionMode: true,
    sourceMilestoneCompletedAt: true,
    sourceSessionLinkMode: true,
    sourceSessionHourlyRate: true,
  })
  .extend({
    total: z.coerce.number().min(0),
    status: invoiceStatusSchema.optional(),
    invoiceType: invoiceTypeSchema.optional(),
    sourceMilestoneAmountType: milestoneAmountTypeSchema.nullable().optional(),
    sourceMilestoneAmountValue: z.coerce.number().nullable().optional(),
    sourceMilestoneCompletionMode: milestoneCompletionModeSchema.nullable().optional(),
    sourceMilestoneCompletedAt: z.string().nullable().optional(),
    sourceSessionLinkMode: invoiceSessionLinkModeSchema.nullable().optional(),
    sourceSessionHourlyRate: z.coerce.number().nullable().optional(),
  })
  .strict();

const assignSessionsSchema = z.object({
  invoiceId: z.string().min(1),
  sessionIds: z.array(z.string().min(1)),
}).strict();

const deleteInvoiceSchema = z.object({
  invoiceId: z.string().min(1),
}).strict();

function getRequestAction(request: Request, params?: { action?: string }): string | undefined {
  const routeAction = params?.action;
  if (typeof routeAction === 'string' && routeAction.trim()) {
    return routeAction;
  }

  try {
    const lastPathSegment = new URL(request.url).pathname.split('/').filter(Boolean).at(-1);
    return lastPathSegment && lastPathSegment !== 'db' ? lastPathSegment : undefined;
  } catch {
    return undefined;
  }
}

export async function POST(
  request: Request,
  { params }: { params?: { action?: string } },
): Promise<Response> {
  const action = getRequestAction(request, params);

  switch (action) {
    case 'create':
      return handleDbWrite(request, createInvoiceSchema, createInvoice);
    case 'assign-sessions':
      return handleDbWrite(request, assignSessionsSchema, assignSessionsToInvoice);
    case 'delete':
      return handleDbWrite(request, deleteInvoiceSchema, deleteInvoice);
    default:
      return Response.json({ error: `Unsupported invoices action: ${action ?? 'unknown'}` }, { status: 404 });
  }
}
