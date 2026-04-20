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
  const message = formatReferralError(error);
  return Response.json(
    { error: message },
    { status },
  );
}

function formatReferralError(error: unknown): string {
  const message = getErrorText(error);
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : error && typeof error === 'object' && 'cause' in error
        ? String((error as { cause?: { code?: unknown } }).cause?.code ?? '')
        : '';

  if (
    code === '42P01' ||
    /relation\s+"?mercury_referrals"?\s+does not exist/i.test(message)
  ) {
    return 'Mercury referral tables are not migrated. Run `npm run db:migrate` against this Supabase database, then restart the dev server.';
  }

  return message || 'Mercury referral request failed.';
}

function getErrorText(error: unknown): string {
  if (!(error instanceof Error)) {
    return '';
  }

  const cause =
    error && typeof error === 'object' && 'cause' in error
      ? (error as { cause?: unknown }).cause
      : null;
  const causeMessage = cause instanceof Error ? cause.message : '';
  return [error.message, causeMessage].filter(Boolean).join('\n');
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
