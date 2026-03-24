import { z } from 'zod';
import { handleDbWrite } from '@/app/api/db/_shared/route';
import { assignSessionsToInvoice, createInvoice } from '@/app/api/db/_queries/invoices';
import { invoiceInsertSchema } from '@/database/hosted/invoices/schema';

const invoiceStatusSchema = z.enum(['draft', 'sent', 'paid', 'overdue']);
const invoiceTypeSchema = z.enum(['hourly', 'milestone']);
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

export async function POST(
  request: Request,
  { params }: { params: { action: string } },
): Promise<Response> {
  switch (params.action) {
    case 'create':
      return handleDbWrite(request, createInvoiceSchema, createInvoice);
    case 'assign-sessions':
      return handleDbWrite(request, assignSessionsSchema, assignSessionsToInvoice);
    default:
      return Response.json({ error: `Unsupported invoices action: ${params.action}` }, { status: 404 });
  }
}
