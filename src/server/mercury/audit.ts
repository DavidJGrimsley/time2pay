import { sql } from 'drizzle-orm';
import type { WriteDb } from '@/server/db/_shared/db';

export type MercuryCredentialAction =
  | 'created'
  | 'rotated'
  | 'tested'
  | 'deleted'
  | 'ar_probed';

export type MercuryCredentialEventInput = {
  authUserId: string;
  action: MercuryCredentialAction;
  keyLastFour?: string | null;
  success?: boolean | null;
  errorCode?: string | null;
};

export async function recordMercuryCredentialEvent(
  db: WriteDb,
  event: MercuryCredentialEventInput,
): Promise<void> {
  try {
    await db.execute(sql`
      insert into mercury_credential_events (
        auth_user_id, action, key_last_four, success, error_code
      ) values (
        ${event.authUserId}::uuid,
        ${event.action},
        ${event.keyLastFour ?? null},
        ${event.success ?? null},
        ${event.errorCode ?? null}
      )
    `);
  } catch (error) {
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String((error as { code?: unknown }).code ?? '')
        : '';
    console.warn('Mercury audit event failed', { action: event.action, code });
  }
}

export function classifyMercuryError(error: unknown): string {
  if (!error) {
    return 'unknown_error';
  }

  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';

  if (/401|unauthori[sz]ed|invalid api key/i.test(message)) {
    return 'mercury_unauthorized';
  }
  if (/403|forbidden|not allowed|requires.*plan/i.test(message)) {
    return 'mercury_forbidden';
  }
  if (/404|not found/i.test(message)) {
    return 'mercury_not_found';
  }
  if (/429|rate limit/i.test(message)) {
    return 'mercury_rate_limited';
  }
  if (/network|fetch failed|ENOTFOUND|ECONNREFUSED|timeout/i.test(message)) {
    return 'network_failure';
  }
  if (/no mercury api key/i.test(message)) {
    return 'no_credential';
  }
  return 'mercury_request_failed';
}
