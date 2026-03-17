import { describe, expect, it, vi } from 'vitest';
import { createMercuryClient, MercuryValidationError } from './index';

describe('createMercuryClient', () => {
  it('retries GET requests after a transient 500', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'retry' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ accounts: [{ id: 'acc_1' }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    const client = createMercuryClient({
      apiKey: 'token',
      fetch: fetchMock,
      retry: { retries: 2, baseDelayMs: 1 },
    });
    const result = await client.accounts.list();

    expect(result.items[0]?.id).toBe('acc_1');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('requires idempotency for send money', () => {
    const client = createMercuryClient({
      apiKey: 'token',
      fetch: vi.fn<typeof fetch>(),
    });

    expect(() => client.sendMoney.send('acc_1', { idempotencyKey: '' })).toThrow(MercuryValidationError);
  });

  it('updates recipients via POST', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ recipient: { id: 'recipient_1' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const client = createMercuryClient({
      apiKey: 'token',
      fetch: fetchMock,
    });

    await client.recipients.update('recipient_1', { nickname: 'Updated Nickname' });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/recipient/recipient_1'),
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
