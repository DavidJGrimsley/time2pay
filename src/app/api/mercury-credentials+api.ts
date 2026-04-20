import { requireAuthUserId } from '@/server/db/_shared/auth';
import {
  deleteMercuryCredentialForUser,
  getMercuryCredentialStatusForUser,
  saveMercuryCredentialForUser,
  testMercuryCredentialForUser,
} from '@/server/mercury/credentials';

type MercuryCredentialActionRequest =
  | { action: 'status' }
  | { action: 'save'; payload?: { apiKey?: string } }
  | { action: 'delete' }
  | { action: 'test' };

async function parseRequest(request: Request): Promise<MercuryCredentialActionRequest> {
  const body = (await request.json()) as MercuryCredentialActionRequest;
  if (!body || typeof body.action !== 'string') {
    throw new Error('Missing required "action" field.');
  }
  return body;
}

function errorResponse(error: unknown, status = 400): Response {
  return Response.json(
    { error: error instanceof Error ? error.message : 'Mercury credential request failed.' },
    { status },
  );
}

export async function POST(request: Request): Promise<Response> {
  let authUserId: string;
  let payload: MercuryCredentialActionRequest;

  try {
    authUserId = await requireAuthUserId(request);
    payload = await parseRequest(request);
  } catch (error) {
    return errorResponse(error, 401);
  }

  try {
    switch (payload.action) {
      case 'status':
        return Response.json(await getMercuryCredentialStatusForUser(authUserId));
      case 'save':
        return Response.json(
          await saveMercuryCredentialForUser(authUserId, payload.payload?.apiKey ?? ''),
        );
      case 'delete':
        await deleteMercuryCredentialForUser(authUserId);
        return Response.json({ ok: true });
      case 'test':
        await testMercuryCredentialForUser(authUserId);
        return Response.json({ ok: true });
      default:
        return errorResponse(new Error('Unsupported Mercury credential action.'));
    }
  } catch (error) {
    return errorResponse(error);
  }
}
