import { requireAuthUserId } from '@/server/db/_shared/auth';
import {
  deleteMercuryCredentialForUser,
  getMercuryCredentialStatusForUser,
  saveMercuryCredentialForUser,
  setMercuryArAccessForUser,
  testMercuryCredentialForUser,
} from '@/server/mercury/credentials';
import { formatMercuryUnauthorizedMessage } from '@/server/mercury/messages';
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

const SUPPORT_CONTACT = 'If this keeps happening, please contact mrdj@davidjgrimsley.com.';

function formatCredentialError(error: unknown): string {
  const message = getErrorText(error);
  const status = getMercuryHttpStatus(error);
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : error && typeof error === 'object' && 'cause' in error
        ? String((error as { cause?: { code?: unknown } }).cause?.code ?? '')
        : '';

  // Passthrough errors that don't need a support-contact suffix:
  // - protocol / dev errors (the UI usually retries or fixes these itself)
  // - user-actionable errors with self-explanatory copy
  const passthroughPatterns: RegExp[] = [
    /^Missing Bearer token\.?$/i,
    /^Invalid Supabase session token\.?$/i,
    /^Missing required "action" field\.?$/i,
    /^Unsupported Mercury credential action\.?$/i,
    /^Mercury API key is required\.?$/i,
    /Sandbox keys are only used in tour mode\./i,
  ];
  if (passthroughPatterns.some((re) => re.test(message))) {
    return message;
  }

  if (status === 401 || /\b401\b|invalid.*token|unauthori[sz]ed/i.test(message)) {
    return formatMercuryUnauthorizedMessage();
  }

  // Server-side configuration / schema problems — not actionable by the
  // end user; ask them to reach out so we can fix it server-side.
  if (
    code === '42P01' ||
    /relation\s+"?mercury_credentials"?\s+does not exist/i.test(message)
  ) {
    return `This server isn't fully set up for Mercury yet. ${SUPPORT_CONTACT}`;
  }

  if (
    code === '42703' ||
    /column\s+.+\s+does not exist/i.test(message)
  ) {
    return `Mercury database schema is out of date on this environment. ${SUPPORT_CONTACT}`;
  }

  if (
    code === '42883' ||
    /function\s+vault\.\w+/i.test(message) ||
    /relation\s+"?vault\./i.test(message)
  ) {
    return `Mercury secret storage isn't available on this environment. ${SUPPORT_CONTACT}`;
  }

  if (/Missing MERCURY_API_KEY_ENCRYPTION_SECRET/i.test(message)) {
    return `This server is missing required Mercury configuration. ${SUPPORT_CONTACT}`;
  }

  // GCM auth-tag / decryption failures — encrypted with a different secret.
  if (/unable to authenticate data|bad decrypt|invalid authentication tag/i.test(message)) {
    return `We couldn't read your saved Mercury key on this environment. Please re-save your key in Profile. ${SUPPORT_CONTACT}`;
  }

  // Generic catch-all: surface the underlying message but always append
  // the contact so the user has a path forward.
  return `${message || 'Mercury credential request failed.'} ${SUPPORT_CONTACT}`;
}

function getMercuryHttpStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const status = (error as { status?: unknown }).status;
  if (typeof status === 'number') {
    return status;
  }

  const cause = (error as { cause?: { status?: unknown } }).cause;
  return typeof cause?.status === 'number' ? cause.status : null;
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
