import { describe, expect, it } from 'vitest';
import { parseMercuryWebhookEvent, verifyMercuryWebhookSignature } from './webhooks';

const payload = JSON.stringify({ id: 'evt_1', type: 'invoice.updated' });

describe('mercury webhooks', () => {
  it('parses valid webhook payloads', () => {
    expect(parseMercuryWebhookEvent(payload).id).toBe('evt_1');
  });

  it('verifies configurable HMAC signatures', async () => {
    const key = await globalThis.crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode('secret'),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const signature = await globalThis.crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(payload),
    );
    const hex = Array.from(new Uint8Array(signature))
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('');

    await expect(
      verifyMercuryWebhookSignature({
        secret: 'secret',
        payload,
        signature: `sha256=${hex}`,
        prefix: 'sha256',
      }),
    ).resolves.toBe(true);
  });
});
