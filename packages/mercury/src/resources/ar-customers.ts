import type { MercuryTransport } from '../client';
import type { MercuryCustomer, MercuryRecord } from '../types';
import { normalizeMercuryEmail, normalizeMercuryName } from '../utils';

export function createArCustomersResource(transport: MercuryTransport) {
  async function ensureCustomer(input: { name: string; email: string }): Promise<string> {
    let cursor: string | null = null;
    const desiredEmail = normalizeMercuryEmail(input.email);
    const desiredName = normalizeMercuryName(input.name);

    for (let page = 0; page < 20; page += 1) {
      const result: {
        items: MercuryCustomer[];
        page?: { nextPage?: string | null };
      } = await transport.requestCollection<MercuryCustomer>('/ar/customers', ['customers'], {
        query: {
          limit: 200,
          order: 'asc',
          start_after: cursor ?? undefined,
        },
      });

      const match = result.items.find((customer: MercuryCustomer) => {
        const candidateEmail = normalizeMercuryEmail(customer.email ?? '');
        const candidateName = normalizeMercuryName(customer.name ?? '');
        return !customer.deletedAt && (candidateEmail === desiredEmail || candidateName === desiredName);
      });

      if (match?.id) {
        return match.id;
      }

      const nextPage: string | null = result.page?.nextPage ?? null;
      if (!nextPage || nextPage === cursor || result.items.length === 0) {
        break;
      }

      cursor = nextPage;
    }

    const created = await transport.requestJson<MercuryCustomer>('/ar/customers', {
      method: 'POST',
      body: {
        name: input.name.trim(),
        email: input.email.trim(),
      },
    });

    return created.id;
  }

  return {
    list(query?: Record<string, string | number | boolean | null | undefined>) {
      return transport.requestCollection<MercuryCustomer>('/ar/customers', ['customers'], { query });
    },
    create(input: MercuryRecord) {
      return transport.requestJson<MercuryCustomer>('/ar/customers', {
        method: 'POST',
        body: input,
      });
    },
    get(customerId: string) {
      return transport.requestJson<MercuryCustomer>(`/ar/customers/${encodeURIComponent(customerId)}`);
    },
    update(customerId: string, input: MercuryRecord) {
      return transport.requestJson<MercuryCustomer>(`/ar/customers/${encodeURIComponent(customerId)}`, {
        method: 'PATCH',
        body: input,
      });
    },
    delete(customerId: string) {
      return transport.requestJson<MercuryRecord>(`/ar/customers/${encodeURIComponent(customerId)}`, {
        method: 'DELETE',
      });
    },
    ensureCustomer,
  };
}
