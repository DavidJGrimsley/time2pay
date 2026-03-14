import type { MercuryCollection, MercuryPageInfo, MercuryRecord } from '../types';

export function isMercuryRecord(value: unknown): value is MercuryRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function asMercuryRecord(value: unknown): MercuryRecord {
  return isMercuryRecord(value) ? value : {};
}

export function asMercuryArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function parseMercuryPageInfo(value: unknown): MercuryPageInfo | undefined {
  if (!isMercuryRecord(value)) {
    return undefined;
  }

  return {
    nextPage: typeof value.nextPage === 'string' ? value.nextPage : null,
    previousPage: typeof value.previousPage === 'string' ? value.previousPage : null,
  };
}

export function parseMercuryCollection<T extends MercuryRecord>(
  value: unknown,
  keys: string[],
): MercuryCollection<T> {
  const raw = asMercuryRecord(value);

  for (const key of keys) {
    const items = asMercuryArray<T>(raw[key]);
    if (items.length > 0 || Array.isArray(raw[key])) {
      return {
        items,
        page: parseMercuryPageInfo(raw.page),
        raw,
      };
    }
  }

  return {
    items: [],
    page: parseMercuryPageInfo(raw.page),
    raw,
  };
}
