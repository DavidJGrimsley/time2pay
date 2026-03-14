import type { MercuryTransport } from '../client';
import type { MercuryAttachment, MercuryInvoiceResponse, MercuryRecord } from '../types';

export function createArInvoicesResource(transport: MercuryTransport) {
  return {
    list(query?: Record<string, string | number | boolean | null | undefined>) {
      return transport.requestCollection<MercuryInvoiceResponse>('/ar/invoices', ['invoices'], { query });
    },
    create(input: MercuryRecord) {
      return transport.requestJson<MercuryInvoiceResponse>('/ar/invoices', {
        method: 'POST',
        body: input,
      });
    },
    get(invoiceId: string) {
      return transport.requestJson<MercuryInvoiceResponse>(`/ar/invoices/${encodeURIComponent(invoiceId)}`);
    },
    update(invoiceId: string, input: MercuryRecord) {
      return transport.requestJson<MercuryInvoiceResponse>(`/ar/invoices/${encodeURIComponent(invoiceId)}`, {
        method: 'PATCH',
        body: input,
      });
    },
    cancel(invoiceId: string) {
      return transport.requestJson<MercuryInvoiceResponse>(`/ar/invoices/${encodeURIComponent(invoiceId)}/cancel`, {
        method: 'POST',
      });
    },
    downloadPdf(invoiceId: string) {
      return transport.requestArrayBuffer(`/ar/invoices/${encodeURIComponent(invoiceId)}/pdf`);
    },
    listAttachments(invoiceId: string) {
      return transport.requestCollection<MercuryAttachment>(
        `/ar/invoices/${encodeURIComponent(invoiceId)}/attachments`,
        ['attachments'],
      );
    },
  };
}
