import type Stripe from 'stripe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BillingError } from '@/server/billing/errors';

const mocks = vi.hoisted(() => ({
  resolveHostedAccess: vi.fn(),
  getStripeBillingConfig: vi.fn(),
  getStripeWebhookSecret: vi.fn(),
  withWriteDb: vi.fn(),
  getBillingCustomerForUser: vi.fn(),
  claimBillingWebhookEvent: vi.fn(),
  markBillingWebhookEventProcessed: vi.fn(),
  markBillingWebhookEventFailed: vi.fn(),
  getBillingCustomerByProviderCustomer: vi.fn(),
  getBillingSubscriptionByProviderSubscription: vi.fn(),
  upsertBillingCustomer: vi.fn(),
  upsertBillingSubscription: vi.fn(),
  upsertBillingPurchase: vi.fn(),
  upsertAccessGrant: vi.fn(),
  expireAccessGrant: vi.fn(),
  revokeAccessGrant: vi.fn(),
  updateBillingPurchaseStatus: vi.fn(),
}));

vi.mock('@/server/billing/entitlements', () => ({
  resolveHostedAccess: mocks.resolveHostedAccess,
}));

vi.mock('@/server/billing/stripe', () => ({
  getStripeBillingConfig: mocks.getStripeBillingConfig,
  getStripeWebhookSecret: mocks.getStripeWebhookSecret,
}));

vi.mock('@/server/db/_shared/db', () => ({
  withWriteDb: mocks.withWriteDb,
}));

vi.mock('@/database/hosted/billing/queries', () => ({
  claimBillingWebhookEvent: mocks.claimBillingWebhookEvent,
  expireAccessGrant: mocks.expireAccessGrant,
  getBillingCustomerByProviderCustomer: mocks.getBillingCustomerByProviderCustomer,
  getBillingCustomerForUser: mocks.getBillingCustomerForUser,
  getBillingSubscriptionByProviderSubscription: mocks.getBillingSubscriptionByProviderSubscription,
  markBillingWebhookEventFailed: mocks.markBillingWebhookEventFailed,
  markBillingWebhookEventProcessed: mocks.markBillingWebhookEventProcessed,
  revokeAccessGrant: mocks.revokeAccessGrant,
  updateBillingPurchaseStatus: mocks.updateBillingPurchaseStatus,
  upsertAccessGrant: mocks.upsertAccessGrant,
  upsertBillingCustomer: mocks.upsertBillingCustomer,
  upsertBillingPurchase: mocks.upsertBillingPurchase,
  upsertBillingSubscription: mocks.upsertBillingSubscription,
}));

const fakeDb = {};

function stripeConfig(overrides: Record<string, unknown> = {}): unknown {
  return {
    siteOrigin: 'https://time2pay.example',
    priceIds: {
      annual: 'price_annual',
      monthly: 'price_monthly',
      mercury_lifetime: 'price_mercury_lifetime',
    },
    gracePeriodDays: 7,
    client: {
      customers: {
        create: vi.fn(),
        retrieve: vi.fn().mockResolvedValue({
          deleted: false,
          invoice_settings: { default_payment_method: null },
        }),
        update: vi.fn(),
      },
      checkout: {
        sessions: {
          create: vi.fn(),
          retrieve: vi.fn(),
          listLineItems: vi.fn(),
        },
      },
      subscriptions: {
        retrieve: vi.fn(),
        list: vi.fn().mockResolvedValue({ data: [] }),
        update: vi.fn(),
      },
      paymentMethods: { retrieve: vi.fn() },
      setupIntents: { create: vi.fn() },
      webhooks: { constructEvent: vi.fn() },
      ...overrides,
    },
  };
}

function stripeSubscription(
  overrides: {
    id: string;
    status: Stripe.Subscription.Status;
    priceId?: string;
    periodEnd?: number;
    metadata?: Record<string, string>;
    cancelAtPeriodEnd?: boolean;
  },
): Stripe.Subscription {
  return {
    id: overrides.id,
    customer: 'cus_123',
    metadata: overrides.metadata ?? { authUserId: 'user-1' },
    status: overrides.status,
    cancel_at_period_end: overrides.cancelAtPeriodEnd ?? false,
    canceled_at: overrides.status === 'canceled' ? 1_700_000_000 : null,
    items: {
      data: [
        {
          price: { id: overrides.priceId ?? 'price_annual' },
          current_period_start: 1_900_000_000,
          current_period_end: overrides.periodEnd ?? 2_000_000_000,
        },
      ],
    },
  } as unknown as Stripe.Subscription;
}

describe('Stripe billing service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.withWriteDb.mockImplementation(async (work: (db: typeof fakeDb) => unknown) => work(fakeDb));
    mocks.getBillingCustomerForUser.mockResolvedValue({ providerCustomerId: 'cus_123' });
    mocks.resolveHostedAccess.mockResolvedValue({
      hasAccess: false,
      status: 'payment_required',
      source: null,
      validUntil: null,
      eligibleOffers: ['annual', 'monthly'],
    });
    mocks.getBillingSubscriptionByProviderSubscription.mockResolvedValue(null);
  });

  it('creates an annual Checkout Session only from the configured server price', async () => {
    const config = stripeConfig() as {
      client: { checkout: { sessions: { create: ReturnType<typeof vi.fn> } } };
    };
    config.client.checkout.sessions.create.mockResolvedValue({
      client_secret: 'cs_test_secret_123',
    });
    mocks.getStripeBillingConfig.mockReturnValue(config);
    const { createStripeCheckoutSession } = await import('@/server/billing/stripe-service');

    await expect(createStripeCheckoutSession('user-1', 'annual')).resolves.toEqual({
      clientSecret: 'cs_test_secret_123',
    });

    expect(config.client.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'subscription',
        customer: 'cus_123',
        line_items: [{ price: 'price_annual', quantity: 1 }],
        metadata: { authUserId: 'user-1', offer: 'annual' },
        ui_mode: 'embedded_page',
        redirect_on_completion: 'if_required',
        return_url:
          'https://time2pay.example/settings/billing?checkout=return&session_id={CHECKOUT_SESSION_ID}',
        branding_settings: {
          background_color: '#f8f7f3',
          button_color: '#1a1f16',
          border_style: 'rounded',
          display_name: 'Time2Pay',
          font_family: 'inter',
        },
      }),
    );
  });

  it('uses darker Stripe branding when the checkout session starts in dark mode', async () => {
    const config = stripeConfig() as {
      client: { checkout: { sessions: { create: ReturnType<typeof vi.fn> } } };
    };
    config.client.checkout.sessions.create.mockResolvedValue({
      client_secret: 'cs_test_secret_dark',
    });
    mocks.getStripeBillingConfig.mockReturnValue(config);
    const { createStripeCheckoutSession } = await import('@/server/billing/stripe-service');

    await createStripeCheckoutSession('user-1', 'annual', undefined, 'dark');

    expect(config.client.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        branding_settings: {
          background_color: '#24291f',
          button_color: '#d4955f',
          border_style: 'rounded',
          display_name: 'Time2Pay',
          font_family: 'inter',
        },
      }),
    );
  });

  it('refuses the hidden Mercury lifetime offer before contacting Stripe when the server says it is ineligible', async () => {
    mocks.resolveHostedAccess.mockResolvedValue({
      hasAccess: false,
      status: 'payment_required',
      source: null,
      validUntil: null,
      eligibleOffers: ['annual', 'monthly'],
    });
    const { createStripeCheckoutSession } = await import('@/server/billing/stripe-service');

    await expect(createStripeCheckoutSession('user-1', 'mercury_lifetime')).rejects.toMatchObject({
      status: 403,
      code: 'billing_offer_ineligible',
    } satisfies Partial<BillingError>);

    expect(mocks.getStripeBillingConfig).not.toHaveBeenCalled();
  });

  it('returns redirect payment methods to the active localhost Expo port', async () => {
    const config = stripeConfig() as {
      siteOrigin: string;
      client: { checkout: { sessions: { create: ReturnType<typeof vi.fn> } } };
    };
    config.siteOrigin = 'http://localhost:3000';
    config.client.checkout.sessions.create.mockResolvedValue({
      client_secret: 'cs_test_secret_local',
    });
    mocks.getStripeBillingConfig.mockReturnValue(config);
    const { createStripeCheckoutSession } = await import('@/server/billing/stripe-service');

    await createStripeCheckoutSession(
      'user-1',
      'annual',
      'http://localhost:8081/api/billing/checkout',
    );

    expect(config.client.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        return_url:
          'http://localhost:8081/settings/billing?checkout=return&session_id={CHECKOUT_SESSION_ID}',
      }),
    );
  });

  it('returns the current subscription for the in-app billing manager', async () => {
    const config = stripeConfig() as {
      client: { subscriptions: { list: ReturnType<typeof vi.fn> } };
    };
    config.client.subscriptions.list.mockResolvedValue({
      data: [
        stripeSubscription({
          id: 'sub_annual',
          status: 'active',
          priceId: 'price_annual',
        }),
      ],
    });
    mocks.getStripeBillingConfig.mockReturnValue(config);
    const { getStripeSubscriptionManagement } = await import(
      '@/server/billing/stripe-service'
    );

    await expect(getStripeSubscriptionManagement('user-1')).resolves.toEqual({
      plan: 'annual',
      status: 'active',
      currentPeriodEnd: new Date(2_000_000_000 * 1000).toISOString(),
      cancelAtPeriodEnd: false,
      paymentMethod: null,
    });
  });

  it('returns the current card summary without storing card data in Time2Pay', async () => {
    const config = stripeConfig() as {
      client: {
        subscriptions: { list: ReturnType<typeof vi.fn> };
        paymentMethods: { retrieve: ReturnType<typeof vi.fn> };
      };
    };
    const subscription = stripeSubscription({
      id: 'sub_annual',
      status: 'active',
      priceId: 'price_annual',
    });
    Object.assign(subscription, { default_payment_method: 'pm_card_123' });
    config.client.subscriptions.list.mockResolvedValue({ data: [subscription] });
    config.client.paymentMethods.retrieve.mockResolvedValue({
      id: 'pm_card_123',
      customer: 'cus_123',
      type: 'card',
      card: { brand: 'visa', last4: '4242', exp_month: 8, exp_year: 2030 },
    });
    mocks.getStripeBillingConfig.mockReturnValue(config);
    const { getStripeSubscriptionManagement } = await import(
      '@/server/billing/stripe-service'
    );

    await expect(getStripeSubscriptionManagement('user-1')).resolves.toMatchObject({
      paymentMethod: { brand: 'visa', last4: '4242', expMonth: 8, expYear: 2030 },
    });
  });

  it('creates a customer-bound SetupIntent before showing the payment-method form', async () => {
    const config = stripeConfig() as {
      client: {
        subscriptions: { list: ReturnType<typeof vi.fn> };
        setupIntents: { create: ReturnType<typeof vi.fn> };
      };
    };
    config.client.subscriptions.list.mockResolvedValue({
      data: [stripeSubscription({ id: 'sub_annual', status: 'active' })],
    });
    config.client.setupIntents.create.mockResolvedValue({ client_secret: 'seti_secret_123' });
    mocks.getStripeBillingConfig.mockReturnValue(config);
    const { createStripePaymentMethodSetup } = await import('@/server/billing/stripe-service');

    await expect(createStripePaymentMethodSetup('user-1')).resolves.toEqual({
      clientSecret: 'seti_secret_123',
    });
    expect(config.client.setupIntents.create).toHaveBeenCalledWith({
      customer: 'cus_123',
      payment_method_types: ['card'],
      usage: 'off_session',
    });
  });

  it('uses a confirmed customer card for future subscription invoices', async () => {
    const config = stripeConfig() as {
      client: {
        customers: { update: ReturnType<typeof vi.fn> };
        subscriptions: {
          list: ReturnType<typeof vi.fn>;
          update: ReturnType<typeof vi.fn>;
        };
        paymentMethods: { retrieve: ReturnType<typeof vi.fn> };
      };
    };
    const subscription = stripeSubscription({ id: 'sub_annual', status: 'active' });
    config.client.subscriptions.list.mockResolvedValue({ data: [subscription] });
    config.client.paymentMethods.retrieve.mockResolvedValue({
      id: 'pm_card_456',
      customer: 'cus_123',
      type: 'card',
      card: { brand: 'mastercard', last4: '4444', exp_month: 10, exp_year: 2031 },
    });
    config.client.subscriptions.update.mockResolvedValue(subscription);
    mocks.getStripeBillingConfig.mockReturnValue(config);
    const { updateStripePaymentMethod } = await import('@/server/billing/stripe-service');

    await expect(updateStripePaymentMethod('user-1', 'pm_card_456')).resolves.toMatchObject({
      paymentMethod: { brand: 'mastercard', last4: '4444' },
    });
    expect(config.client.customers.update).toHaveBeenCalledWith('cus_123', {
      invoice_settings: { default_payment_method: 'pm_card_456' },
    });
    expect(config.client.subscriptions.update).toHaveBeenCalledWith('sub_annual', {
      default_payment_method: 'pm_card_456',
    });
  });

  it('turns renewal off through the authenticated subscription manager', async () => {
    const currentSubscription = stripeSubscription({
      id: 'sub_annual',
      status: 'active',
      priceId: 'price_annual',
    });
    const updatedSubscription = stripeSubscription({
      id: 'sub_annual',
      status: 'active',
      priceId: 'price_annual',
      cancelAtPeriodEnd: true,
    });
    const config = stripeConfig() as {
      client: {
        subscriptions: {
          list: ReturnType<typeof vi.fn>;
          update: ReturnType<typeof vi.fn>;
        };
      };
    };
    config.client.subscriptions.list
      .mockResolvedValueOnce({ data: [currentSubscription] })
      .mockResolvedValue({ data: [updatedSubscription] });
    config.client.subscriptions.update.mockResolvedValue(updatedSubscription);
    mocks.getStripeBillingConfig.mockReturnValue(config);
    const { updateStripeSubscriptionManagement } = await import(
      '@/server/billing/stripe-service'
    );

    await expect(
      updateStripeSubscriptionManagement('user-1', 'cancel_at_period_end'),
    ).resolves.toMatchObject({
      plan: 'annual',
      cancelAtPeriodEnd: true,
    });
    expect(config.client.subscriptions.update).toHaveBeenCalledWith('sub_annual', {
      cancel_at_period_end: true,
    });
  });

  it('acknowledges duplicate verified Stripe events without replaying billing work', async () => {
    const config = stripeConfig() as {
      client: { webhooks: { constructEvent: ReturnType<typeof vi.fn> } };
    };
    config.client.webhooks.constructEvent.mockReturnValue({
      id: 'evt_duplicate',
      type: 'checkout.session.completed',
      data: { object: {} },
    });
    mocks.getStripeBillingConfig.mockReturnValue(config);
    mocks.getStripeWebhookSecret.mockReturnValue('whsec_test');
    mocks.claimBillingWebhookEvent.mockResolvedValue(false);
    const { processStripeWebhook } = await import('@/server/billing/stripe-service');

    await expect(
      processStripeWebhook(Buffer.from('{"id":"evt_duplicate"}'), 't=1,v1=signature'),
    ).resolves.toEqual({ duplicate: true });

    expect(mocks.markBillingWebhookEventProcessed).not.toHaveBeenCalled();
    expect(mocks.markBillingWebhookEventFailed).not.toHaveBeenCalled();
  });

  it('reconciles subscription events from Stripe current state instead of the stale event payload', async () => {
    const config = stripeConfig() as {
      client: {
        webhooks: { constructEvent: ReturnType<typeof vi.fn> };
        subscriptions: {
          retrieve: ReturnType<typeof vi.fn>;
          list: ReturnType<typeof vi.fn>;
        };
      };
    };
    config.client.webhooks.constructEvent.mockReturnValue({
      id: 'evt_subscription_updated',
      type: 'customer.subscription.updated',
      data: { object: { id: 'sub_123', status: 'past_due' } },
    });
    const currentSubscription = stripeSubscription({ id: 'sub_123', status: 'active' });
    config.client.subscriptions.retrieve.mockResolvedValue(currentSubscription);
    config.client.subscriptions.list.mockResolvedValue({ data: [currentSubscription] });
    mocks.getStripeBillingConfig.mockReturnValue(config);
    mocks.getStripeWebhookSecret.mockReturnValue('whsec_test');
    mocks.claimBillingWebhookEvent.mockResolvedValue(true);
    const { processStripeWebhook } = await import('@/server/billing/stripe-service');

    await expect(
      processStripeWebhook(Buffer.from('{"id":"evt_subscription_updated"}'), 't=1,v1=signature'),
    ).resolves.toEqual({ duplicate: false });

    expect(config.client.subscriptions.retrieve).toHaveBeenCalledWith('sub_123');
    expect(mocks.upsertBillingSubscription).toHaveBeenCalledWith(
      fakeDb,
      expect.objectContaining({ status: 'active', providerSubscriptionId: 'sub_123' }),
    );
  });

  it.each([
    ['canceled before active', ['sub_canceled', 'sub_active']],
    ['active before canceled', ['sub_active', 'sub_canceled']],
  ])(
    'keeps subscription access active when manual sync sees %s',
    async (_label, subscriptionOrder) => {
      const config = stripeConfig() as {
        client: { subscriptions: { list: ReturnType<typeof vi.fn> } };
      };
      const subscriptionsById = {
        sub_active: stripeSubscription({ id: 'sub_active', status: 'active' }),
        sub_canceled: stripeSubscription({ id: 'sub_canceled', status: 'canceled' }),
      };
      config.client.subscriptions.list.mockResolvedValue({
        data: subscriptionOrder.map((id) => subscriptionsById[id as keyof typeof subscriptionsById]),
      });
      mocks.getStripeBillingConfig.mockReturnValue(config);
      const { syncStripeBillingForUser } = await import('@/server/billing/stripe-service');

      await syncStripeBillingForUser('user-1');

      expect(config.client.subscriptions.list).toHaveBeenCalledTimes(1);
      expect(mocks.expireAccessGrant).not.toHaveBeenCalled();
      expect(mocks.upsertAccessGrant).toHaveBeenCalledTimes(1);
      expect(mocks.upsertAccessGrant).toHaveBeenCalledWith(
        fakeDb,
        expect.objectContaining({
          authUserId: 'user-1',
          source: 'stripe_subscription',
          sourceReferenceId: 'sub_active',
          metadata: { plan: 'annual', subscriptionStatus: 'active' },
        }),
      );
      expect(mocks.resolveHostedAccess).toHaveBeenCalledWith('user-1');
    },
  );

  it('expires subscription access only after Stripe reports no entitled subscriptions', async () => {
    const config = stripeConfig() as {
      client: { subscriptions: { list: ReturnType<typeof vi.fn> } };
    };
    config.client.subscriptions.list.mockResolvedValue({
      data: [stripeSubscription({ id: 'sub_canceled', status: 'canceled' })],
    });
    mocks.getStripeBillingConfig.mockReturnValue(config);
    const { syncStripeBillingForUser } = await import('@/server/billing/stripe-service');

    await syncStripeBillingForUser('user-1');

    expect(mocks.upsertAccessGrant).not.toHaveBeenCalled();
    expect(mocks.expireAccessGrant).toHaveBeenCalledTimes(1);
    expect(mocks.expireAccessGrant).toHaveBeenCalledWith(fakeDb, 'user-1', 'stripe_subscription');
  });

  it('does not let a canceled subscription webhook revoke a separate active subscription', async () => {
    const config = stripeConfig() as {
      client: {
        webhooks: { constructEvent: ReturnType<typeof vi.fn> };
        subscriptions: {
          retrieve: ReturnType<typeof vi.fn>;
          list: ReturnType<typeof vi.fn>;
        };
      };
    };
    const canceledSubscription = stripeSubscription({ id: 'sub_canceled', status: 'canceled' });
    const activeSubscription = stripeSubscription({ id: 'sub_active', status: 'active' });
    config.client.webhooks.constructEvent.mockReturnValue({
      id: 'evt_subscription_deleted',
      type: 'customer.subscription.deleted',
      data: { object: { id: 'sub_canceled' } },
    });
    config.client.subscriptions.retrieve.mockResolvedValue(canceledSubscription);
    config.client.subscriptions.list.mockResolvedValue({
      data: [canceledSubscription, activeSubscription],
    });
    mocks.getStripeBillingConfig.mockReturnValue(config);
    mocks.getStripeWebhookSecret.mockReturnValue('whsec_test');
    mocks.claimBillingWebhookEvent.mockResolvedValue(true);
    const { processStripeWebhook } = await import('@/server/billing/stripe-service');

    await expect(
      processStripeWebhook(Buffer.from('{"id":"evt_subscription_deleted"}'), 't=1,v1=signature'),
    ).resolves.toEqual({ duplicate: false });

    expect(mocks.expireAccessGrant).not.toHaveBeenCalled();
    expect(mocks.upsertAccessGrant).toHaveBeenCalledWith(
      fakeDb,
      expect.objectContaining({
        sourceReferenceId: 'sub_active',
        metadata: { plan: 'annual', subscriptionStatus: 'active' },
      }),
    );
  });
});
