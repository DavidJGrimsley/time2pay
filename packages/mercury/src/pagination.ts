import type { MercuryCollection } from './types';

export type MercuryCursorPageFetcher<T> = (
  cursor?: string | null,
) => Promise<MercuryCollection<T>>;

export async function* createMercuryCursorIterator<T>(
  fetchPage: MercuryCursorPageFetcher<T>,
): AsyncGenerator<T, void, void> {
  let cursor: string | null | undefined;
  let guard = 0;

  while (guard < 100) {
    const page = await fetchPage(cursor);
    for (const item of page.items) {
      yield item;
    }

    const nextPage = page.page?.nextPage ?? null;
    if (!nextPage || nextPage === cursor || page.items.length === 0) {
      return;
    }

    cursor = nextPage;
    guard += 1;
  }
}

export async function collectMercuryCursor<T>(
  iterator: AsyncIterable<T>,
): Promise<T[]> {
  const items: T[] = [];
  for await (const item of iterator) {
    items.push(item);
  }
  return items;
}
