import { requireAuthUserId } from '@/server/db/_shared/auth';
import {
  getMercuryReferralStatusForUser,
  recordMercuryReferralClickForUser,
} from '@/server/mercury/referrals';

type MercuryReferralActionRequest =
  | { action: 'status' }
  | { action: 'trackClick' };

async function parseRequest(request: Request): Promise<MercuryReferralActionRequest> {
  const body = (await request.json()) as MercuryReferralActionRequest;
  if (!body || typeof body.action !== 'string') {
    throw new Error('Missing required "action" field.');
  }
  return body;
}

function errorResponse(error: unknown, status = 400): Response {
  return Response.json(
    { error: error instanceof Error ? error.message : 'Mercury referral request failed.' },
    { status },
  );
}

export async function POST(request: Request): Promise<Response> {
  let authUserId: string;
  let payload: MercuryReferralActionRequest;

  try {
    authUserId = await requireAuthUserId(request);
    payload = await parseRequest(request);
  } catch (error) {
    return errorResponse(error, 401);
  }

  try {
    switch (payload.action) {
      case 'status':
        return Response.json(await getMercuryReferralStatusForUser(authUserId));
      case 'trackClick':
        return Response.json(await recordMercuryReferralClickForUser(authUserId));
      default:
        return errorResponse(new Error('Unsupported Mercury referral action.'));
    }
  } catch (error) {
    return errorResponse(error);
  }
}
