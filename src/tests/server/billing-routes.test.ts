import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAuthUserId: vi.fn(),
  resolveHostedAccess: vi.fn(),
  isHostedAccessEnforcementEnabled: vi.fn(),
  createStripeCheckoutSession: vi.fn(),
  createStripePaymentMethodSetup: vi.fn(),
  getStripeSubscriptionManagement: vi.fn(),
  previewStripeSubscriptionPlanSwitch: vi.fn(),
  removeStripePaymentMethod: vi.fn(),
  updateStripePaymentMethod: vi.fn(),
  updateStripeSubscriptionManagement: vi.fn(),
  syncStripeBillingForUser: vi.fn(),
  processStripeWebhook: vi.fn(),
}));

vi.mock('@/server/db/_shared/auth', () => ({
  requireAuthUserId: mocks.requireAuthUserId,
}));

vi.mock('@/server/billing/entitlements', () => ({
  isHostedAccessEnforcementEnabled: mocks.isHostedAccessEnforcementEnabled,
  resolveHostedAccess: mocks.resolveHostedAccess,
}));

vi.mock('@/server/billing/stripe-service', () => ({
  createStripeCheckoutSession: mocks.createStripeCheckoutSession,
  createStripePaymentMethodSetup: mocks.createStripePaymentMethodSetup,
  getStripeSubscriptionManagement: mocks.getStripeSubscriptionManagement,
  previewStripeSubscriptionPlanSwitch: mocks.previewStripeSubscriptionPlanSwitch,
  removeStripePaymentMethod: mocks.removeStripePaymentMethod,
  updateStripePaymentMethod: mocks.updateStripePaymentMethod,
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
    mocks.isHostedAccessEnforcementEnabled.mockReturnValue(true);
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

  it('exposes hosted billing status with the server enforcement flag', async () => {
    mocks.isHostedAccessEnforcementEnabled.mockReturnValue(false);
    mocks.resolveHostedAccess.mockResolvedValue({
      hasAccess: false,
      status: 'payment_required',
      source: null,
      validUntil: null,
      eligibleOffers: ['monthly', 'annual'],
    });
    const { GET } = await import('@/app/api/billing/status+api');

    const response = await GET(
      new Request('http://localhost/api/billing/status', {
        headers: { Authorization: 'Bearer supabase-token' },
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.resolveHostedAccess).toHaveBeenCalledWith('user-1');
    await expect(response.json()).resolves.toEqual({
      hasAccess: false,
      status: 'payment_required',
      source: null,
      validUntil: null,
      eligibleOffers: ['monthly', 'annual'],
      enforcementEnabled: false,
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
      paymentMethod: null,
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
      paymentMethod: null,
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
      { action: 'cancel_at_period_end' },
    );
  });

  it('passes the requested target plan to the subscription updater', async () => {
    mocks.updateStripeSubscriptionManagement.mockResolvedValue({
      plan: 'monthly',
      status: 'active',
      currentPeriodEnd: '2032-05-18T03:33:20.000Z',
      cancelAtPeriodEnd: false,
      paymentMethod: null,
    });
    const { POST } = await import('@/app/api/billing/subscription+api');
    const response = await POST(
      authenticatedRequest('/api/billing/subscription', {
        action: 'switch_plan',
        plan: 'monthly',
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.updateStripeSubscriptionManagement).toHaveBeenCalledWith('user-1', {
      action: 'switch_plan',
      plan: 'monthly',
    });
  });

  it('rejects a client-supplied proration timestamp', async () => {
    const { POST } = await import('@/app/api/billing/subscription+api');
    const response = await POST(
      authenticatedRequest('/api/billing/subscription', {
        action: 'switch_plan',
        plan: 'monthly',
        prorationDate: 1,
      }),
    );

    expect(response.status).toBe(422);
    expect(mocks.updateStripeSubscriptionManagement).not.toHaveBeenCalled();
  });

  it('previews a Stripe-prorated plan switch before updating the subscription', async () => {
    mocks.previewStripeSubscriptionPlanSwitch.mockResolvedValue({
      currentPlan: 'annual',
      targetPlan: 'monthly',
      currency: 'usd',
      prorationDate: 1_900_000_000,
      proratedCreditCents: 1800,
      immediateChargeCents: 200,
      amountDueNowCents: 0,
      futureCreditCents: 1600,
    });
    const { POST } = await import('@/app/api/billing/subscription+api');
    const response = await POST(
      authenticatedRequest('/api/billing/subscription', {
        action: 'preview_switch_plan',
        plan: 'monthly',
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.previewStripeSubscriptionPlanSwitch).toHaveBeenCalledWith('user-1', 'monthly');
    await expect(response.json()).resolves.toMatchObject({
      targetPlan: 'monthly',
      futureCreditCents: 1600,
    });
  });

  it('creates an authenticated payment-method SetupIntent', async () => {
    mocks.createStripePaymentMethodSetup.mockResolvedValue({ clientSecret: 'seti_secret_123' });
    const { POST } = await import('@/app/api/billing/payment-method+api');

    const response = await POST(
      authenticatedRequest('/api/billing/payment-method', { action: 'create_setup' }),
    );

    expect(response.status).toBe(200);
    expect(mocks.createStripePaymentMethodSetup).toHaveBeenCalledWith('user-1');
    await expect(response.json()).resolves.toEqual({ clientSecret: 'seti_secret_123' });
  });

  it('only accepts a validated payment-method id when changing the subscription default', async () => {
    mocks.updateStripePaymentMethod.mockResolvedValue({
      plan: 'annual',
      status: 'active',
      currentPeriodEnd: '2033-05-18T03:33:20.000Z',
      cancelAtPeriodEnd: false,
      paymentMethod: { brand: 'visa', last4: '4242', expMonth: 8, expYear: 2030 },
    });
    const { POST } = await import('@/app/api/billing/payment-method+api');

    const response = await POST(
      authenticatedRequest('/api/billing/payment-method', {
        action: 'set_default',
        paymentMethodId: 'pm_card_123',
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.updateStripePaymentMethod).toHaveBeenCalledWith('user-1', 'pm_card_123');
  });

  it('routes saved-card removal through the Stripe detach service', async () => {
    mocks.removeStripePaymentMethod.mockResolvedValue({
      plan: 'annual',
      status: 'active',
      currentPeriodEnd: '2033-05-18T03:33:20.000Z',
      cancelAtPeriodEnd: true,
      paymentMethod: null,
    });
    const { POST } = await import('@/app/api/billing/payment-method+api');

    const response = await POST(
      authenticatedRequest('/api/billing/payment-method', { action: 'remove_card' }),
    );

    expect(response.status).toBe(200);
    expect(mocks.removeStripePaymentMethod).toHaveBeenCalledWith('user-1');
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
