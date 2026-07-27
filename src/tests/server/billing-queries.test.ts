import { describe, expect, it, vi } from 'vitest';
import {
  claimBillingWebhookEvent,
  upsertBillingCustomer,
} from '@/database/hosted/billing/queries';

function sqlText(query: unknown): string {
  const chunks = (query as { queryChunks?: unknown[] }).queryChunks ?? [];
  return chunks
    .map((chunk) => {
      if (chunk && typeof chunk === 'object' && 'value' in (chunk as { value?: unknown })) {
        const value = (chunk as { value?: unknown }).value;
        return Array.isArray(value) ? value.join('') : String(value ?? '');
      }
      return '?';
    })
    .join('');
}

function sqlParameterValues(query: unknown): unknown[] {
  const chunks = (query as { queryChunks?: unknown[] }).queryChunks ?? [];
  return chunks.flatMap((chunk) => {
    if (
      typeof chunk === 'string' ||
      typeof chunk === 'number' ||
      typeof chunk === 'boolean' ||
      chunk === null
    ) {
      return [chunk];
    }

    if (!chunk || typeof chunk !== 'object' || !('value' in (chunk as { value?: unknown }))) {
      return [];
    }

    const value = (chunk as { value?: unknown }).value;
    return Array.isArray(value) ? [] : [value];
  });
}

describe('billing webhook event claims', () => {
  it('reclaims failed events but leaves processed and in-flight duplicates untouched', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [{ id: 'event-row' }] });
    const claimed = await claimBillingWebhookEvent(
      { execute } as never,
      {
        provider: 'stripe',
        providerEventId: 'evt_retry',
        eventType: 'invoice.payment_failed',
      },
    );

    expect(claimed).toBe(true);
    const statement = sqlText(execute.mock.calls[0]?.[0]).replace(/\s+/g, ' ').toLowerCase();
    expect(statement).toContain('on conflict (provider, provider_event_id) do update');
    expect(statement).toContain("where billing_webhook_events.status = 'failed'");
    expect(statement).toContain("status = 'received'");
  });
});

describe('billing customer persistence', () => {
  it('creates a hosted profile row before inserting a billing customer', async () => {
    const execute = vi.fn().mockResolvedValue({ rows: [] });

    await upsertBillingCustomer(
      { execute } as never,
      {
        authUserId: '7f5c2be8-6963-432f-b84d-b81635cf0477',
        provider: 'stripe',
        providerCustomerId: 'cus_123',
      },
    );

    expect(execute).toHaveBeenCalledTimes(2);
    const profileStatement = sqlText(execute.mock.calls[0]?.[0])
      .replace(/\s+/g, ' ')
      .toLowerCase();
    const customerStatement = sqlText(execute.mock.calls[1]?.[0])
      .replace(/\s+/g, ' ')
      .toLowerCase();

    expect(profileStatement).toContain('insert into user_profiles');
    expect(profileStatement).toContain('on conflict (auth_user_id) do nothing');
    expect(customerStatement).toContain('insert into billing_customers');

    const customerParams = sqlParameterValues(execute.mock.calls[1]?.[0]);
    expect(customerParams.some((value) => value instanceof Date)).toBe(false);
    expect(customerParams.filter((value) => typeof value === 'string')).toEqual(
      expect.arrayContaining([expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)]),
    );
  });
});