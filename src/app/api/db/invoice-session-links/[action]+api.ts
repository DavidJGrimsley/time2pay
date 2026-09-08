import { z } from 'zod';
import { handleDbWrite } from '@/server/db/_shared/route';
import { upsertInvoiceSessionLinks } from '@/server/db/_queries/invoice-session-links';
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
    case 'upsert':
      return handleDbWrite(request, upsertLinksSchema, upsertInvoiceSessionLinks);
    default:
      return Response.json(
        { error: `Unsupported invoice-session-links action: ${action ?? 'unknown'}` },
        { status: 404 },
      );
  }
}
