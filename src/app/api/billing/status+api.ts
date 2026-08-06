import { resolveHostedAccess } from '@/server/billing/entitlements';
import { billingErrorResponse } from '@/server/billing/errors';
import { requireBillingAuthUserId } from '@/server/billing/routes';

export async function GET(request: Request): Promise<Response> {
  try {
    const authUserId = await requireBillingAuthUserId(request);
    return Response.json(await resolveHostedAccess(authUserId));
  } catch (error) {
    return billingErrorResponse(error);
  }
}