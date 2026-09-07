import { z } from 'zod';
import { handleDbWrite } from '@/server/db/_shared/route';
import { upsertInvoiceMilestoneLinks } from '@/server/db/_queries/invoice-milestone-links';

const schema = z.object({
  invoiceId: z.string().min(1),
  links: z.array(z.object({
    milestoneId: z.string().min(1),
    projectId: z.string().min(1),
    projectName: z.string().nullable(),
    title: z.string().min(1),
    amount: z.number().nonnegative(),
    amountType: z.enum(['percent', 'fixed']),
    amountValue: z.number().nonnegative(),
    completionMode: z.enum(['toggle', 'checklist']),
    completedAt: z.string().nullable(),
  })),
}).strict();

export async function POST(request: Request): Promise<Response> {
  return handleDbWrite(request, schema, upsertInvoiceMilestoneLinks);
}
