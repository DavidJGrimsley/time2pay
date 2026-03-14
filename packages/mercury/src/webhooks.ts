import { MercuryValidationError } from './errors';
import type { MercuryWebhookEvent, MercuryWebhookVerificationInput } from './types';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function toArrayBuffer(payload: string | ArrayBuffer | Uint8Array): ArrayBuffer {
  if (typeof payload === 'string') {
    const encoded = textEncoder.encode(payload);
    const copy = new Uint8Array(encoded.byteLength);
    copy.set(encoded);
    return copy.buffer;
  }

  if (payload instanceof Uint8Array) {
    const copy = new Uint8Array(payload.byteLength);
    copy.set(payload);
    return copy.buffer;
  }

  return payload.slice(0);
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

function stripPrefix(signature: string, prefix: string | undefined): string {
  if (!prefix) {
    return signature.trim();
  }

  const expectedPrefix = `${prefix}=`;
  return signature.startsWith(expectedPrefix) ? signature.slice(expectedPrefix.length) : signature;
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return mismatch === 0;
}

async function createExpectedSignature(secret: string, payload: ArrayBuffer): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto is required to verify Mercury webhook signatures.');
  }

  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await globalThis.crypto.subtle.sign('HMAC', key, payload);
  return toHex(new Uint8Array(signature));
}

export async function verifyMercuryWebhookSignature(
  input: MercuryWebhookVerificationInput,
): Promise<boolean> {
  const payloadBuffer = toArrayBuffer(input.payload);
  const expected = await createExpectedSignature(input.secret, payloadBuffer);
  const received = stripPrefix(input.signature.trim().toLowerCase(), input.prefix).toLowerCase();
  return timingSafeEqual(expected, received);
}

export function parseMercuryWebhookEvent(
  payload: string | ArrayBuffer | Uint8Array,
): MercuryWebhookEvent {
  const raw = typeof payload === 'string' ? payload : textDecoder.decode(new Uint8Array(toArrayBuffer(payload)));

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Mercury webhook payload must be a JSON object.');
    }
    return parsed as MercuryWebhookEvent;
  } catch (error) {
    throw new MercuryValidationError(
      error instanceof Error ? error.message : 'Mercury webhook payload must be valid JSON.',
      { method: 'LOCAL', path: 'webhooks.parseEvent' },
    );
  }
}
