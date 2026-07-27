import { z } from 'zod';
import { BILLING_SUBSCRIPTION_ACTIONS } from '@/database/hosted/billing/types';
import { billingErrorResponse } from '@/server/billing/errors';
import { parseBillingJson, requireBillingAuthUserId } from '@/server/billing/routes';
import {
  getStripeSubscriptionManagement,
  updateStripeSubscriptionManagement,
} from '@/server/billing/stripe-service';

const subscriptionActionSchema = z
  .object({
    action: z.enum(BILLING_SUBSCRIPTION_ACTIONS),
  })
  .strict();

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
    const { action } = await parseBillingJson(request, subscriptionActionSchema);
    return Response.json(await updateStripeSubscriptionManagement(authUserId, action));
  } catch (error) {
    return billingErrorResponse(error);
  }
}
