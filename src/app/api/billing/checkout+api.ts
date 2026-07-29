import { z } from 'zod';
import { billingErrorResponse } from '@/server/billing/errors';
import { parseBillingJson, requireBillingAuthUserId } from '@/server/billing/routes';
import { createStripeCheckoutSession } from '@/server/billing/stripe-service';

const checkoutSchema = z
  .object({
    offer: z.enum(['annual', 'monthly', 'mercury_lifetime']),
    theme: z.enum(['light', 'dark']).optional().default('light'),
  })
  .strict();

export async function POST(request: Request): Promise<Response> {
  try {
    const authUserId = await requireBillingAuthUserId(request);
    const { offer, theme } = await parseBillingJson(request, checkoutSchema);
    return Response.json(await createStripeCheckoutSession(authUserId, offer, request.url, theme));
  } catch (error) {
    return billingErrorResponse(error);
  }
}
