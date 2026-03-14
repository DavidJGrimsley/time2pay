import type { MercuryTransport } from '../client';
import type {
  MercuryAttachment,
  MercuryAttachmentUploadInput,
  MercuryRecipient,
  MercuryRecord,
} from '../types';

export function createRecipientsResource(transport: MercuryTransport) {
  return {
    list(query?: Record<string, string | number | boolean | null | undefined>) {
      return transport.requestCollection<MercuryRecipient>('/recipients', ['recipients'], { query });
    },
    create(input: MercuryRecord) {
      return transport.requestJson<MercuryRecipient>('/recipients', {
        method: 'POST',
        body: input,
      });
    },
    get(recipientId: string) {
      return transport.requestJson<MercuryRecipient>(`/recipient/${encodeURIComponent(recipientId)}`);
    },
    update(recipientId: string, input: MercuryRecord) {
      return transport.requestJson<MercuryRecipient>(`/recipient/${encodeURIComponent(recipientId)}`, {
        method: 'PATCH',
        body: input,
      });
    },
    uploadAttachment(recipientId: string, input: MercuryAttachmentUploadInput) {
      return transport.requestJson<MercuryAttachment>(`/recipient/${encodeURIComponent(recipientId)}/attachment`, {
        method: 'POST',
        body: transport.buildAttachmentFormData(input),
      });
    },
  };
}
