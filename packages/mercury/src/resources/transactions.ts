import type { MercuryTransport } from '../client';
import type {
  MercuryAttachment,
  MercuryAttachmentUploadInput,
  MercuryRecord,
  MercuryTransaction,
} from '../types';

export function createTransactionsResource(transport: MercuryTransport) {
  return {
    list(query?: Record<string, string | number | boolean | null | undefined>) {
      return transport.requestCollection<MercuryTransaction>('/transactions', ['transactions'], { query });
    },
    get(transactionId: string) {
      return transport.requestJson<MercuryTransaction>(`/transaction/${encodeURIComponent(transactionId)}`);
    },
    update(transactionId: string, input: MercuryRecord) {
      return transport.requestJson<MercuryTransaction>(`/transaction/${encodeURIComponent(transactionId)}`, {
        method: 'PATCH',
        body: input,
      });
    },
    uploadAttachment(transactionId: string, input: MercuryAttachmentUploadInput) {
      return transport.requestJson<MercuryAttachment>(
        `/transaction/${encodeURIComponent(transactionId)}/attachment`,
        {
          method: 'POST',
          body: transport.buildAttachmentFormData(input),
        },
      );
    },
  };
}
