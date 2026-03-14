import { MercuryValidationError } from '../errors';
import type { MercuryTransport } from '../client';
import type { MercuryRecord, MercuryTransferInput } from '../types';

export function createTransfersResource(transport: MercuryTransport) {
  return {
    create(input: MercuryTransferInput) {
      const { idempotencyKey, ...body } = input;
      if (!idempotencyKey?.trim()) {
        throw new MercuryValidationError('Transfers require an idempotencyKey.', {
          method: 'POST',
          path: '/transfer',
        });
      }

      return transport.requestJson<MercuryRecord>('/transfer', {
        method: 'POST',
        body,
        idempotencyKey,
      });
    },
  };
}
