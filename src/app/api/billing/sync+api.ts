import { z } from 'zod';
import { billingErrorResponse } from '@/server/billing/errors';
import { parseBillingJson, requireBillingAuthUserId } from '@/server/billing/routes';
import { syncStripeBillingForUser } from '@/server/billing/stripe-service';

const syncSchema = z
  .object({
    checkoutSessionId: z.string().min(1).optional(),
  })
  .strict();

export async function POST(request: Request): Promise<Response> {
  try {
    const authUserId = await requireBillingAuthUserId(request);
    const { checkoutSessionId } = await parseBillingJson(request, syncSchema);
    return Response.json(await syncStripeBillingForUser(authUserId, checkoutSessionId));
  } catch (error) {
    return billingErrorResponse(error);
  }
}