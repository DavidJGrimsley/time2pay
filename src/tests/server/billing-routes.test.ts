import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAuthUserId: vi.fn(),
  resolveHostedAccess: vi.fn(),
  createStripeCheckoutSession: vi.fn(),
  getStripeSubscriptionManagement: vi.fn(),
  updateStripeSubscriptionManagement: vi.fn(),
  syncStripeBillingForUser: vi.fn(),
  processStripeWebhook: vi.fn(),
}));

vi.mock('@/server/db/_shared/auth', () => ({
  requireAuthUserId: mocks.requireAuthUserId,
}));

vi.mock('@/server/billing/entitlements', () => ({
  resolveHostedAccess: mocks.resolveHostedAccess,
}));

vi.mock('@/server/billing/stripe-service', () => ({
  createStripeCheckoutSession: mocks.createStripeCheckoutSession,
  getStripeSubscriptionManagement: mocks.getStripeSubscriptionManagement,
  updateStripeSubscriptionManagement: mocks.updateStripeSubscriptionManagement,
  syncStripeBillingForUser: mocks.syncStripeBillingForUser,
  processStripeWebhook: mocks.processStripeWebhook,
}));

function authenticatedRequest(path: string, body: unknown = {}): Request {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer supabase-token',
    },
    body: JSON.stringify(body),
  });
}

describe('billing API routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuthUserId.mockResolvedValue('user-1');
  });

  it('requires authentication before exposing hosted billing status', async () => {
    mocks.requireAuthUserId.mockRejectedValue(new Error('Missing Bearer token.'));
    const { GET } = await import('@/app/api/billing/status+api');

    const response = await GET(new Request('http://localhost/api/billing/status'));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: 'Authentication is required.',
      code: 'unauthorized',
    });
  });

  it('passes only a validated checkout offer to the server-side Stripe service', async () => {
    mocks.createStripeCheckoutSession.mockResolvedValue({ clientSecret: 'cs_test_secret_123' });
    const { POST } = await import('@/app/api/billing/checkout+api');

    const response = await POST(authenticatedRequest('/api/billing/checkout', { offer: 'annual', theme: 'dark' }));

    expect(response.status).toBe(200);
    expect(mocks.createStripeCheckoutSession).toHaveBeenCalledWith(
      'user-1',
      'annual',
      'http://localhost/api/billing/checkout',
      'dark',
    );
    await expect(response.json()).resolves.toEqual({ clientSecret: 'cs_test_secret_123' });
  });

  it('rejects unsupported Checkout payload fields before Stripe is called', async () => {
    const { POST } = await import('@/app/api/billing/checkout+api');

    const response = await POST(
      authenticatedRequest('/api/billing/checkout', { offer: 'annual', amountCents: 1 }),
    );

    expect(response.status).toBe(422);
    expect(mocks.createStripeCheckoutSession).not.toHaveBeenCalled();
  });

  it('returns the signed-in customer subscription summary', async () => {
    mocks.getStripeSubscriptionManagement.mockResolvedValue({
      plan: 'annual',
      status: 'active',
      currentPeriodEnd: '2033-05-18T03:33:20.000Z',
      cancelAtPeriodEnd: false,
    });
    const { GET } = await import('@/app/api/billing/subscription+api');
    const response = await GET(
      new Request('http://localhost/api/billing/subscription', {
        headers: { Authorization: 'Bearer supabase-token' },
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.getStripeSubscriptionManagement).toHaveBeenCalledWith('user-1');
  });

  it('validates and applies an on-page subscription action', async () => {
    mocks.updateStripeSubscriptionManagement.mockResolvedValue({
      plan: 'annual',
      status: 'active',
      currentPeriodEnd: '2033-05-18T03:33:20.000Z',
      cancelAtPeriodEnd: true,
    });
    const { POST } = await import('@/app/api/billing/subscription+api');
    const response = await POST(
      authenticatedRequest('/api/billing/subscription', {
        action: 'cancel_at_period_end',
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.updateStripeSubscriptionManagement).toHaveBeenCalledWith(
      'user-1',
      'cancel_at_period_end',
    );
  });

  it('passes an unparsed raw body and Stripe signature to webhook verification', async () => {
    mocks.processStripeWebhook.mockResolvedValue({ duplicate: false });
    const { POST } = await import('@/app/api/webhooks/stripe+api');
    const payload = '{"id":"evt_123","type":"checkout.session.completed"}';

    const response = await POST(
      new Request('http://localhost/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 't=1,v1=signature' },
        body: payload,
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.processStripeWebhook).toHaveBeenCalledWith(
      expect.any(Buffer),
      't=1,v1=signature',
    );
    expect(mocks.processStripeWebhook.mock.calls[0]?.[0].toString()).toBe(payload);
  });
});
