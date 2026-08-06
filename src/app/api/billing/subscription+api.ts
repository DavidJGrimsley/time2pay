import { z } from 'zod';
import { HOSTED_PLANS } from '@/database/hosted/billing/types';
import { billingErrorResponse } from '@/server/billing/errors';
import { parseBillingJson, requireBillingAuthUserId } from '@/server/billing/routes';
import {
  getStripeSubscriptionManagement,
  updateStripeSubscriptionManagement,
} from '@/server/billing/stripe-service';

const subscriptionActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('cancel_at_period_end') }).strict(),
  z.object({ action: z.literal('resume') }).strict(),
  z
    .object({
      action: z.literal('switch_plan'),
      plan: z.enum(HOSTED_PLANS),
      prorationDate: z.number().int().positive().optional(),
    })
    .strict(),
]);

export async function GET(request: Request): Promise<Response> {
  try {
    const authUserId = await requireBillingAuthUserId(request);
    return Response.json(await getStripeSubscriptionManagement(authUserId));
  } catch (error) {
    return billingErrorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const authUserId = await requireBillingAuthUserId(request);
    const payload = await parseBillingJson(request, subscriptionActionSchema);
    return Response.json(await updateStripeSubscriptionManagement(authUserId, payload));
  } catch (error) {
    return billingErrorResponse(error);
  }
}
