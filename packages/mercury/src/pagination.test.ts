import { describe, expect, it } from 'vitest';
import { collectMercuryCursor, createMercuryCursorIterator } from './pagination';

describe('pagination helpers', () => {
  it('iterates until cursor exhaustion', async () => {
    const items = await collectMercuryCursor(
      createMercuryCursorIterator(async (cursor) => {
        if (!cursor) {
          return { items: [{ id: 'one' }], page: { nextPage: 'next' }, raw: {} };
        }

        return { items: [{ id: 'two' }], page: { nextPage: null }, raw: {} };
      }),
    );

    expect(items).toHaveLength(2);
  });
});
