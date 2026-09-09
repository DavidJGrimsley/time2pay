import { requireAuthUserId } from '@/server/db/_shared/auth';
import { z } from 'zod';
import {
  disconnectMercuryOAuthForUser,
  getMercuryOAuthConnectionStatusForUser,
  MercuryOAuthError,
  startMercuryOAuthForUser,
} from '@/server/mercury/oauth';

const mercuryOAuthActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('status') }).strict(),
  z.object({ action: z.literal('start') }).strict(),
  z.object({ action: z.literal('disconnect') }).strict(),
]);

type MercuryOAuthActionRequest = z.infer<typeof mercuryOAuthActionSchema>;

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

function json(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: NO_STORE_HEADERS });
}

function errorResponse(error: unknown, fallbackStatus = 400): Response {
  if (error instanceof MercuryOAuthError) {
    return json({ error: error.message, code: error.code }, error.status);
  }
  const message =
    fallbackStatus === 401 && error instanceof Error
      ? error.message
      : fallbackStatus === 400
        ? 'Invalid Mercury OAuth request.'
        : 'Mercury OAuth request failed.';
  return json({ error: message }, fallbackStatus);
}

export async function POST(request: Request): Promise<Response> {
  let authUserId: string;
  try {
    authUserId = await requireAuthUserId(request);
  } catch (error) {
    return errorResponse(error, 401);
  }

  let payload: MercuryOAuthActionRequest;
  try {
    payload = mercuryOAuthActionSchema.parse(await request.json());
  } catch (error) {
    return errorResponse(error);
  }

  try {
    switch (payload.action) {
      case 'status':
        return json(await getMercuryOAuthConnectionStatusForUser(authUserId));
      case 'start':
        return json(await startMercuryOAuthForUser(authUserId));
      case 'disconnect':
        return json(await disconnectMercuryOAuthForUser(authUserId));
      default:
        return json({ error: 'Unsupported Mercury OAuth action.' }, 400);
    }
  } catch (error) {
    return errorResponse(error);
  }
}
