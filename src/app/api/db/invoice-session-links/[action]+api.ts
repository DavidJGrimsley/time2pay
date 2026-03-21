import { z } from 'zod';
import { handleDbWrite } from '@/app/api/db/_shared/route';
import { upsertInvoiceSessionLinks } from '@/app/api/db/_queries/invoice-session-links';
import { invoiceSessionLinkInsertSchema } from '@/database/hosted/invoice-session-links/schema';

const upsertLinksSchema = invoiceSessionLinkInsertSchema
  .pick({
    invoiceId: true,
    linkMode: true,
  })
  .extend({
    sessionIds: z.array(z.string().min(1)).min(1),
    linkMode: z.enum(['context', 'billed']),
  })
  .strict();

export async function POST(
  request: Request,
  { params }: { params: { action: string } },
): Promise<Response> {
  switch (params.action) {
    case 'upsert':
      return handleDbWrite(request, upsertLinksSchema, upsertInvoiceSessionLinks);
    default:
      return Response.json(
        { error: `Unsupported invoice-session-links action: ${params.action}` },
        { status: 404 },
      );
  }
}
