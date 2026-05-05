const MERCURY_TOKEN_PATTERN = /(mercury_(?:test|production|sandbox)_[A-Za-z0-9_-]+)/g;
// Match long opaque bearer tokens (JWTs, opaque secrets) — not the literal word "token".
const BEARER_PATTERN = /(Bearer\s+)([A-Za-z0-9._-]{16,})/gi;

export function redactMercuryString(value: string): string {
  return value.replace(MERCURY_TOKEN_PATTERN, 'mercury_redacted').replace(
    BEARER_PATTERN,
    '$1redacted',
  );
}

export function redactMercuryError(error: unknown): {
  message: string;
  code: string | null;
  status: number | null;
} {
  if (!error) {
    return { message: 'unknown_error', code: null, status: null };
  }

  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code ?? '') || null
      : null;
  const status =
    error && typeof error === 'object' && 'status' in error &&
    typeof (error as { status?: unknown }).status === 'number'
      ? (error as { status: number }).status
      : error && typeof error === 'object' && 'statusCode' in error &&
          typeof (error as { statusCode?: unknown }).statusCode === 'number'
        ? (error as { statusCode: number }).statusCode
        : null;

  return {
    message: redactMercuryString(rawMessage || 'unknown_error'),
    code,
    status,
  };
}
