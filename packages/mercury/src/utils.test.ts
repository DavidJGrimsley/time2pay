import { describe, expect, it } from 'vitest';
import {
  buildMercuryLineItems,
  createMercuryIdempotencyKey,
  findBestCheckingAccount,
} from './utils';

describe('mercury utils', () => {
  it('prefers active checking accounts', () => {
    const best = findBestCheckingAccount([
      { id: 'savings', name: 'Savings', type: 'savings', status: 'active' },
      { id: 'checking', name: 'Checking', type: 'mercury-checking', status: 'active' },
    ]);

    expect(best?.id).toBe('checking');
  });

  it('builds fallback line items when explicit items are absent', () => {
    const items = buildMercuryLineItems({
      customerName: 'Client',
      customerEmail: 'client@example.com',
      amount: 125,
      description: 'Weekly work',
    });

    expect(items).toEqual([{ name: 'Weekly work', quantity: 1, unitPrice: 125 }]);
  });

  it('creates idempotency keys with the requested prefix', () => {
    expect(createMercuryIdempotencyKey('invoice')).toMatch(/^invoice_/);
  });
});
