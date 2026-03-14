import { MercuryValidationError } from './errors';
import type { MercuryAccount, MercuryInvoicePayload, MercuryLineItemPayload } from './types';

export function assertNonNegativeFinite(value: number, fieldName: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new MercuryValidationError(
      `Invalid ${fieldName}: expected a non-negative finite number.`,
      { method: 'LOCAL', path: fieldName },
    );
  }

  return value;
}

export function toDayString(inputIso: string): string {
  const parsed = new Date(inputIso);
  if (Number.isNaN(parsed.getTime())) {
    throw new MercuryValidationError(`Invalid date value: ${inputIso}`, {
      method: 'LOCAL',
      path: 'date',
    });
  }

  return parsed.toISOString().slice(0, 10);
}

export function normalizeMercuryEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeMercuryName(name: string): string {
  return name.trim().toLowerCase();
}

function scoreMercuryAccount(account: MercuryAccount): number {
  const status = `${account.status ?? ''}`.toLowerCase();
  const type = `${account.type ?? account.accountType ?? ''}`.toLowerCase();
  const kind = `${account.kind ?? ''}`.toLowerCase();
  const name = `${account.nickname ?? account.name ?? ''}`.toLowerCase();

  let score = 0;
  if (status === 'active') {
    score += 4;
  }
  if (type.includes('mercury')) {
    score += 2;
  }
  if (type.includes('checking') || kind.includes('checking') || name.includes('checking')) {
    score += 6;
  }

  return score;
}

export function findBestCheckingAccount(accounts: MercuryAccount[]): MercuryAccount | null {
  const eligible = accounts.filter(
    (account): account is MercuryAccount & { id: string } =>
      typeof account.id === 'string' && account.id.trim().length > 0,
  );

  if (eligible.length === 0) {
    return null;
  }

  return [...eligible].sort((left, right) => scoreMercuryAccount(right) - scoreMercuryAccount(left))[0] ?? null;
}

export function buildMercuryLineItems(payload: MercuryInvoicePayload): MercuryLineItemPayload[] {
  const explicitItems = payload.lineItems ?? [];
  if (explicitItems.length > 0) {
    return explicitItems.map((lineItem) => ({
      name: lineItem.name.trim() || 'Service',
      quantity: assertNonNegativeFinite(lineItem.quantity, 'line item quantity'),
      unitPrice: assertNonNegativeFinite(lineItem.unitPrice, 'line item unit price'),
      salesTaxRate:
        lineItem.salesTaxRate == null
          ? undefined
          : assertNonNegativeFinite(lineItem.salesTaxRate, 'line item sales tax rate'),
    }));
  }

  return [
    {
      name: payload.description?.trim() || 'Service',
      quantity: 1,
      unitPrice: assertNonNegativeFinite(payload.amount, 'amount'),
    },
  ];
}

export function createMercuryIdempotencyKey(prefix = 'mercury'): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `${prefix}_${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function maskMercuryToken(token: string): string {
  const trimmed = token.trim();
  if (trimmed.length <= 8) {
    return '***';
  }

  return `${trimmed.slice(0, 4)}***${trimmed.slice(-4)}`;
}

export function encodeMercuryQuery(
  query: Record<string, string | number | boolean | null | undefined> | undefined,
): string {
  if (!query) {
    return '';
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value == null) {
      continue;
    }
    params.set(key, String(value));
  }

  const resolved = params.toString();
  return resolved ? `?${resolved}` : '';
}

export function encodeMercuryPath(
  path: string,
  query?: Record<string, string | number | boolean | null | undefined>,
): string {
  if (!path.startsWith('/')) {
    throw new MercuryValidationError("Mercury paths must start with '/'.", {
      method: 'LOCAL',
      path,
    });
  }

  if (path.includes('://') || path.startsWith('//')) {
    throw new MercuryValidationError('Mercury paths must be relative API paths.', {
      method: 'LOCAL',
      path,
    });
  }

  return `${path}${encodeMercuryQuery(query)}`;
}

export function toUploadBytes(file: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (file instanceof Uint8Array) {
    const copy = new Uint8Array(file.byteLength);
    copy.set(file);
    return copy.buffer;
  }

  return file.slice(0);
}
