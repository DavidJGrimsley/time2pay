import { z } from 'zod';
import { billingErrorResponse } from '@/server/billing/errors';
import { parseBillingJson, requireBillingAuthUserId } from '@/server/billing/routes';
import {
  createStripePaymentMethodSetup,
  removeStripePaymentMethod,
  updateStripePaymentMethod,
} from '@/server/billing/stripe-service';

const paymentMethodSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create_setup') }).strict(),
  z.object({ action: z.literal('remove_card') }).strict(),
  z
    .object({
      action: z.literal('set_default'),
      paymentMethodId: z.string().min(1).max(255),
    })
    .strict(),
]);

export async function POST(request: Request): Promise<Response> {
  try {
    const authUserId = await requireBillingAuthUserId(request);
    const payload = await parseBillingJson(request, paymentMethodSchema);
    if (payload.action === 'create_setup') {
      return Response.json(await createStripePaymentMethodSetup(authUserId));
    }
    if (payload.action === 'remove_card') {
      return Response.json(await removeStripePaymentMethod(authUserId));
    }
    return Response.json(await updateStripePaymentMethod(authUserId, payload.paymentMethodId));
  } catch (error) {
    return billingErrorResponse(error);
  }
}
