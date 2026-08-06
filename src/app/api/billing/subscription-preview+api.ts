import { z } from 'zod';
import { HOSTED_PLANS } from '@/database/hosted/billing/types';
import { billingErrorResponse } from '@/server/billing/errors';
import { parseBillingJson, requireBillingAuthUserId } from '@/server/billing/routes';
import { previewStripeSubscriptionPlanSwitch } from '@/server/billing/stripe-service';

const subscriptionPlanSwitchPreviewSchema = z
  .object({
    plan: z.enum(HOSTED_PLANS),
  })
  .strict();

export async function POST(request: Request): Promise<Response> {
  try {
    const authUserId = await requireBillingAuthUserId(request);
    const payload = await parseBillingJson(request, subscriptionPlanSwitchPreviewSchema);
    return Response.json(await previewStripeSubscriptionPlanSwitch(authUserId, payload.plan));
  } catch (error) {
    return billingErrorResponse(error);
  }
}
