import { z } from 'zod';
import { billingErrorResponse } from '@/server/billing/errors';
import { parseBillingJson, requireBillingAuthUserId } from '@/server/billing/routes';
import { createStripeCheckoutSession } from '@/server/billing/stripe-service';

const checkoutSchema = z
  .object({
    offer: z.enum(['annual', 'monthly', 'mercury_lifetime']),
  })
  .strict();

export async function POST(request: Request): Promise<Response> {
  try {
    const authUserId = await requireBillingAuthUserId(request);
    const { offer } = await parseBillingJson(request, checkoutSchema);
    return Response.json(await createStripeCheckoutSession(authUserId, offer, request.url));
  } catch (error) {
    return billingErrorResponse(error);
  }
}
