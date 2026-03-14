import { MercuryValidationError } from '../errors';
import type { MercuryTransport } from '../client';
import type { MercurySendMoneyInput, MercuryTransaction } from '../types';

export function createSendMoneyResource(transport: MercuryTransport) {
  return {
    send(accountId: string, input: MercurySendMoneyInput) {
      const { idempotencyKey, ...body } = input;
      if (!idempotencyKey?.trim()) {
        throw new MercuryValidationError('Send money requires an idempotencyKey.', {
          method: 'POST',
          path: `/account/${accountId}/transactions`,
        });
      }

      return transport.requestJson<MercuryTransaction>(`/account/${encodeURIComponent(accountId)}/transactions`, {
        method: 'POST',
        body,
        idempotencyKey,
      });
    },
  };
}
