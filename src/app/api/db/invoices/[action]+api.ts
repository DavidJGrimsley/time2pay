import { z } from 'zod';
import { handleDbWrite } from '@/app/api/db/_shared/route';
import { assignSessionsToInvoice, createInvoice } from '@/app/api/db/_queries/invoices';

const invoiceStatusSchema = z.enum(['draft', 'sent', 'paid', 'overdue']);
const invoiceTypeSchema = z.enum(['hourly', 'milestone']);
const milestoneAmountTypeSchema = z.enum(['percent', 'fixed']);
const milestoneCompletionModeSchema = z.enum(['toggle', 'checklist']);
const invoiceSessionLinkModeSchema = z.enum(['context', 'billed']);

const createInvoiceSchema = z.object({
  id: z.string().min(1),
  clientId: z.string().min(1),
  total: z.number().min(0),
  status: invoiceStatusSchema.optional(),
  invoiceType: invoiceTypeSchema.optional(),
  mercuryInvoiceId: z.string().nullable().optional(),
  paymentLink: z.string().nullable().optional(),
  sourceProjectId: z.string().nullable().optional(),
  sourceProjectName: z.string().nullable().optional(),
  sourceMilestoneId: z.string().nullable().optional(),
  sourceMilestoneTitle: z.string().nullable().optional(),
  sourceMilestoneAmountType: milestoneAmountTypeSchema.nullable().optional(),
  sourceMilestoneAmountValue: z.number().nullable().optional(),
  sourceMilestoneCompletionMode: milestoneCompletionModeSchema.nullable().optional(),
  sourceMilestoneCompletedAt: z.string().nullable().optional(),
  sourceSessionLinkMode: invoiceSessionLinkModeSchema.nullable().optional(),
  sourceSessionHourlyRate: z.number().nullable().optional(),
});

const assignSessionsSchema = z.object({
  invoiceId: z.string().min(1),
  sessionIds: z.array(z.string().min(1)),
});

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
