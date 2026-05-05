import { requireAuthUserId } from '@/server/db/_shared/auth';
import {
  deleteMercuryCredentialForUser,
  getMercuryCredentialStatusForUser,
  saveMercuryCredentialForUser,
  setMercuryArAccessForUser,
  testMercuryCredentialForUser,
} from '@/server/mercury/credentials';
import { redactMercuryString } from '@/server/mercury/redact';

type MercuryCredentialActionRequest =
  | { action: 'status' }
  | { action: 'save'; payload?: { apiKey?: string } }
  | { action: 'delete' }
  | { action: 'test' }
  | { action: 'setArAccess'; payload?: { enabled?: boolean } };

async function parseRequest(request: Request): Promise<MercuryCredentialActionRequest> {
  const body = (await request.json()) as MercuryCredentialActionRequest;
  if (!body || typeof body.action !== 'string') {
    throw new Error('Missing required "action" field.');
  }
  return body;
}

function errorResponse(error: unknown, status = 400): Response {
  const message = redactMercuryString(formatCredentialError(error));
  return Response.json(
    { error: message },
    { status },
  );
}

function formatCredentialError(error: unknown): string {
  const message = getErrorText(error);
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : error && typeof error === 'object' && 'cause' in error
        ? String((error as { cause?: { code?: unknown } }).cause?.code ?? '')
        : '';

  if (
    code === '42P01' ||
    /relation\s+"?mercury_credentials"?\s+does not exist/i.test(message)
  ) {
    return 'Mercury credential tables are not migrated. Run npm run db:migrate against this Supabase database, then restart the dev server.';
  }

  if (/Missing MERCURY_API_KEY_ENCRYPTION_SECRET/i.test(message)) {
    return 'Missing MERCURY_API_KEY_ENCRYPTION_SECRET. Add it to .env locally or your hosting secrets, then restart the server.';
  }

  return message || 'Mercury credential request failed.';
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
  try {
    authUserId = await requireAuthUserId(request);
  } catch (error) {
    return errorResponse(error, 401);
  }

  let payload: MercuryCredentialActionRequest;
  try {
    payload = await parseRequest(request);
  } catch (error) {
    return errorResponse(error, 400);
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
      case 'setArAccess': {
        const enabled = payload.payload?.enabled === true;
        return Response.json(await setMercuryArAccessForUser(authUserId, enabled));
      }
      default:
        return errorResponse(new Error('Unsupported Mercury credential action.'));
    }
  } catch (error) {
    return errorResponse(error);
  }
}
