import { isHostedAccessEnforcementEnabled, resolveHostedAccess } from '@/server/billing/entitlements';
import { billingErrorResponse } from '@/server/billing/errors';
import { requireBillingAuthUserId } from '@/server/billing/routes';

export async function GET(request: Request): Promise<Response> {
  try {
    const authUserId = await requireBillingAuthUserId(request);
    const hostedAccess = await resolveHostedAccess(authUserId);
    return Response.json({
      ...hostedAccess,
      enforcementEnabled: isHostedAccessEnforcementEnabled(),
    });
  } catch (error) {
    return billingErrorResponse(error);
  }
}
