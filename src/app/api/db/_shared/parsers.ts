export function nowIso(): string {
  return new Date().toISOString();
}

export function toIsoOrNow(value: string | null): string {
  if (!value) {
    return nowIso();
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid ISO timestamp.');
  }
  return parsed.toISOString();
}

export function makeEphemeralId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
