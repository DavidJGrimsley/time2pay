const ISO_8601_UTC_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

export function parseIsoTimestamp(input: string, fieldName: string): Date {
  if (!ISO_8601_UTC_REGEX.test(input)) {
    throw new Error(`Invalid ${fieldName}: expected ISO-8601 UTC timestamp`);
  }

  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid ${fieldName}: expected ISO-8601 UTC timestamp`);
  }

  return parsed;
}

export function ensureNonNegativeDurationMs(start: string, end: string): number {
  const startDate = parseIsoTimestamp(start, 'start_time');
  const endDate = parseIsoTimestamp(end, 'end_time');
  const durationMs = endDate.getTime() - startDate.getTime();

  if (durationMs < 0) {
    throw new Error('Invalid session time range: end_time must be after start_time');
  }

  return durationMs;
}

export function durationMsToSeconds(durationMs: number): number {
  return Math.round(durationMs / 1000);
}

export function assertInvoiceTotal(total: number): void {
  if (!Number.isFinite(total) || total < 0) {
    throw new Error('Invalid invoice total: expected a non-negative finite number');
  }
}
