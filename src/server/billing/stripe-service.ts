import type Stripe from 'stripe';
import {
  claimBillingWebhookEvent,
  expireAccessGrant,
  getBillingCustomerByProviderCustomer,
  getBillingCustomerForUser,
  getBillingSubscriptionByProviderSubscription,
  markBillingWebhookEventFailed,
  markBillingWebhookEventProcessed,
  revokeAccessGrant,
  updateBillingPurchaseStatus,
  upsertAccessGrant,
  upsertBillingCustomer,
  upsertBillingPurchase,
  upsertBillingSubscription,
} from '@/database/hosted/billing/queries';
import type {
  BillingPaymentMethodSummary,
  BillingSubscriptionManagementRequest,
  BillingSubscriptionPlanSwitchPreview,
  BillingSubscriptionStatus,
  BillingSubscriptionSummary,
  HostedAccessResult,
  HostedOffer,
  HostedPlan,
} from '@/database/hosted/billing/types';
import type { BillingCheckoutTheme } from '@/services/billing';
import { resolveHostedAccess } from '@/server/billing/entitlements';
import { BillingError } from '@/server/billing/errors';
import {
  getStripeBillingConfig,
  getStripeWebhookSecret,
  type StripeBillingConfig,
} from '@/server/billing/stripe';
import { withWriteDb } from '@/server/db/_shared/db';

type StripeSubscriptionTerms = {
  providerCustomerId: string;
  providerSubscriptionId: string;
  providerProductId: string;
  plan: HostedPlan;
  status: BillingSubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  canceledAt: Date | null;
};

type SyncedStripeSubscription = StripeSubscriptionTerms & {
  authUserId: string;
  graceExpiresAt: Date | null;
};

const TIME2PAY_CHECKOUT_BRANDING_BY_THEME: Record<
  BillingCheckoutTheme,
  Stripe.Checkout.SessionCreateParams.BrandingSettings
> = {
  light: {
    background_color: '#f8f7f3',
    button_color: '#1a1f16',
    border_style: 'rounded',
    display_name: 'Time2Pay',
    font_family: 'inter',
  },
  dark: {
    background_color: '#24291f',
    button_color: '#d4955f',
    border_style: 'rounded',
    display_name: 'Time2Pay',
    font_family: 'inter',
  },
};

function stripeId(value: string | { id: string } | null | undefined): string | null {
  if (typeof value === 'string') {
    return value;
  }
  return value?.id ?? null;
}

function dateFromEpoch(value: number | null | undefined): Date | null {
  return typeof value === 'number' ? new Date(value * 1000) : null;
}

function addDays(timestamp: Date, days: number): Date {
  const result = new Date(timestamp);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function requireAuthUserId(value: string | null | undefined): string {
  const authUserId = value?.trim() ?? '';
  if (!authUserId) {
    throw new BillingError(
      400,
      'billing_identity_missing',
      'The billing event is missing its Time2Pay account reference.',
    );
  }
  return authUserId;
}

function planForStripePrice(config: StripeBillingConfig, priceId: string): HostedPlan {
  if (priceId === config.priceIds.annual) {
    return 'annual';
  }
  if (priceId === config.priceIds.monthly) {
    return 'monthly';
  }
  throw new BillingError(
    400,
    'unsupported_billing_price',
    'The billing event does not reference a Time2Pay hosted subscription price.',
  );
}

function priceIdForHostedPlan(config: StripeBillingConfig, plan: HostedPlan): string {
  if (plan === 'annual') {
    return config.priceIds.annual;
  }
  return config.priceIds.monthly;
}

function priceIdForOffer(config: StripeBillingConfig, offer: HostedOffer): string {
  const priceId = config.priceIds[offer];
  if (priceId) {
    return priceId;
  }

  throw new BillingError(
    501,
    'billing_offer_not_configured',
    'This billing offer is not configured yet.',
  );
}

function managedSubscriptionItem(
  config: StripeBillingConfig,
  subscription: Stripe.Subscription,
): Stripe.SubscriptionItem {
  const item = subscription.items.data.find(
    (candidate) =>
      candidate.price.id === config.priceIds.annual ||
      candidate.price.id === config.priceIds.monthly,
  );
  if (!item) {
    throw new BillingError(
      400,
      'unsupported_billing_price',
      'The subscription does not include a Time2Pay hosted price.',
    );
  }

  return item;
}

function prorationTimestampForSubscriptionItem(item: Stripe.SubscriptionItem): number {
  const now = Math.floor(Date.now() / 1000);
  const periodStart = item.current_period_start;
  const periodEnd = item.current_period_end;

  if (
    typeof periodStart !== 'number' ||
    typeof periodEnd !== 'number' ||
    periodEnd <= periodStart
  ) {
    return now;
  }

  if (now < periodStart) {
    return periodStart;
  }

  if (now >= periodEnd) {
    return periodEnd - 1;
  }

  return now;
}

function planSwitchSubscriptionItems(
  config: StripeBillingConfig,
  subscription: Stripe.Subscription,
  targetPlan: HostedPlan,
): Stripe.SubscriptionUpdateParams.Item[] {
  const currentItem = managedSubscriptionItem(config, subscription);
  return [
    {
      id: currentItem.id,
      price: priceIdForHostedPlan(config, targetPlan),
      quantity: currentItem.quantity ?? 1,
    },
  ];
}

function isInvoiceProrationLine(line: Stripe.InvoiceLineItem): boolean {
  return (
    line.parent?.subscription_item_details?.proration === true ||
    line.parent?.invoice_item_details?.proration === true
  );
}

function buildPlanSwitchPreview(
  config: StripeBillingConfig,
  subscription: Stripe.Subscription,
  targetPlan: HostedPlan,
  invoice: Stripe.Invoice,
  prorationDate: number,
): BillingSubscriptionPlanSwitchPreview {
  const currentPlan = planForStripePrice(config, managedSubscriptionItem(config, subscription).price.id);
  const prorationLines = invoice.lines.data.filter(isInvoiceProrationLine);
  const proratedCreditCents = prorationLines.reduce(
    (total, line) => (line.amount < 0 ? total + Math.abs(line.amount) : total),
    0,
  );
  const immediateChargeCents = invoice.lines.data.reduce(
    (total, line) => (line.amount > 0 ? total + line.amount : total),
    0,
  );

  return {
    currentPlan,
    targetPlan,
    currency: invoice.currency ?? 'usd',
    prorationDate,
    proratedCreditCents,
    immediateChargeCents,
    amountDueNowCents: Math.max(0, invoice.amount_due ?? 0),
    futureCreditCents: Math.max(0, -(invoice.total ?? 0)),
  };
}

function subscriptionTerms(
  config: StripeBillingConfig,
  subscription: Stripe.Subscription,
): StripeSubscriptionTerms {
  const item = managedSubscriptionItem(config, subscription);

  const providerCustomerId = stripeId(subscription.customer);
  if (!providerCustomerId) {
    throw new BillingError(
      400,
      'billing_customer_missing',
      'The subscription is missing a Stripe customer.',
    );
  }

  const currentPeriodStart = dateFromEpoch(item.current_period_start);
  const currentPeriodEnd = dateFromEpoch(item.current_period_end);
  if (!currentPeriodStart || !currentPeriodEnd) {
    throw new BillingError(
      502,
      'billing_period_missing',
      'Stripe did not provide a subscription billing period.',
    );
  }

  return {
    providerCustomerId,
    providerSubscriptionId: subscription.id,
    providerProductId: item.price.id,
    plan: planForStripePrice(config, item.price.id),
    status: subscription.status as BillingSubscriptionStatus,
    currentPeriodStart,
    currentPeriodEnd,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    canceledAt: dateFromEpoch(subscription.canceled_at),
  };
}

async function resolveSubscriptionUserId(subscription: Stripe.Subscription): Promise<string> {
  const metadataUserId = subscription.metadata?.authUserId;
  if (metadataUserId?.trim()) {
    return metadataUserId.trim();
  }

  const providerCustomerId = stripeId(subscription.customer);
  if (!providerCustomerId) {
    throw new BillingError(
      400,
      'billing_identity_missing',
      'The subscription is missing a Time2Pay account reference.',
    );
  }

  const customer = await withWriteDb((db) =>
    getBillingCustomerByProviderCustomer(db, 'stripe', providerCustomerId),
  );
  if (!customer) {
    throw new BillingError(
      400,
      'billing_identity_missing',
      'The subscription Stripe customer is not linked to a Time2Pay account.',
    );
  }

  return customer.authUserId;
}

async function ensureStripeCustomer(
  config: StripeBillingConfig,
  authUserId: string,
): Promise<string> {
  const existing = await withWriteDb((db) => getBillingCustomerForUser(db, authUserId, 'stripe'));
  if (existing) {
    return existing.providerCustomerId;
  }

  const customer = await config.client.customers.create({
    metadata: { authUserId },
    description: 'Time2Pay hosted billing customer',
  });

  await withWriteDb((db) =>
    upsertBillingCustomer(db, {
      authUserId,
      provider: 'stripe',
      providerCustomerId: customer.id,
    }),
  );

  return customer.id;
}

function isLoopbackHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

function embeddedCheckoutReturnUrl(
  config: StripeBillingConfig,
  requestUrl?: string,
): string {
  let siteOrigin = config.siteOrigin;

  if (requestUrl) {
    const configuredUrl = new URL(config.siteOrigin);
    const activeUrl = new URL(requestUrl);

    // Local Expo can run on any open port. Use that active port only when both
    // origins are loopback addresses; production always stays on the configured origin.
    if (
      isLoopbackHostname(configuredUrl.hostname) &&
      isLoopbackHostname(activeUrl.hostname) &&
      (activeUrl.protocol === 'http:' || activeUrl.protocol === 'https:')
    ) {
      siteOrigin = activeUrl.origin;
    }
  }

  // Stripe replaces the literal placeholder only when its braces remain unescaped.
  return `${siteOrigin}/settings/billing?checkout=return&session_id={CHECKOUT_SESSION_ID}`;
}

function assertOfferAllowed(access: HostedAccessResult, offer: HostedOffer): void {
  if (access.eligibleOffers.includes(offer)) {
    return;
  }

  if (access.hasAccess) {
    throw new BillingError(409, 'hosted_access_active', 'Hosted access is already active for this account.');
  }

  throw new BillingError(
    403,
    'billing_offer_ineligible',
    'This billing offer is not available for this account.',
  );
}

export async function createStripeCheckoutSession(
  authUserId: string,
  offer: HostedOffer,
  requestUrl?: string,
  theme: BillingCheckoutTheme = 'light',
): Promise<{ clientSecret: string }> {
  const access = await resolveHostedAccess(authUserId);
  assertOfferAllowed(access, offer);

  const config = getStripeBillingConfig();
  const customerId = await ensureStripeCustomer(config, authUserId);
  const metadata = { authUserId, offer };
  const isLifetimePurchase = offer === 'mercury_lifetime';

  const session = await config.client.checkout.sessions.create({
    mode: isLifetimePurchase ? 'payment' : 'subscription',
    ui_mode: 'embedded_page',
    redirect_on_completion: 'if_required',
    return_url: embeddedCheckoutReturnUrl(config, requestUrl),
    customer: customerId,
    client_reference_id: authUserId,
    line_items: [{ price: priceIdForOffer(config, offer), quantity: 1 }],
    payment_method_types: ['card'],
    branding_settings: TIME2PAY_CHECKOUT_BRANDING_BY_THEME[theme],
    metadata,
    ...(isLifetimePurchase
      ? { payment_intent_data: { metadata } }
      : { subscription_data: { metadata } }),
  });

  if (!session.client_secret) {
    throw new BillingError(
      502,
      'checkout_client_secret_missing',
      'Stripe did not return an embedded Checkout secret. Please try again.',
    );
  }

  return { clientSecret: session.client_secret };
}

async function syncStripeSubscription(
  config: StripeBillingConfig,
  subscription: Stripe.Subscription,
  authUserId?: string,
  graceStartAt = new Date(),
): Promise<SyncedStripeSubscription> {
  const terms = subscriptionTerms(config, subscription);
  const resolvedAuthUserId = authUserId ?? (await resolveSubscriptionUserId(subscription));
  const previous = await withWriteDb((db) =>
    getBillingSubscriptionByProviderSubscription(db, 'stripe', terms.providerSubscriptionId),
  );
  const graceExpiresAt =
    terms.status === 'past_due'
      ? previous?.graceExpiresAt ?? addDays(graceStartAt, config.gracePeriodDays)
      : null;

  await withWriteDb(async (db) => {
    await upsertBillingCustomer(db, {
      authUserId: resolvedAuthUserId,
      provider: 'stripe',
      providerCustomerId: terms.providerCustomerId,
    });
    await upsertBillingSubscription(db, {
      authUserId: resolvedAuthUserId,
      provider: 'stripe',
      providerCustomerId: terms.providerCustomerId,
      providerSubscriptionId: terms.providerSubscriptionId,
      providerProductId: terms.providerProductId,
      plan: terms.plan,
      status: terms.status,
      currentPeriodStart: terms.currentPeriodStart,
      currentPeriodEnd: terms.currentPeriodEnd,
      graceExpiresAt,
      cancelAtPeriodEnd: terms.cancelAtPeriodEnd,
      canceledAt: terms.canceledAt,
    });
  });

  return { ...terms, authUserId: resolvedAuthUserId, graceExpiresAt };
}

function subscriptionAccessEnd(subscription: SyncedStripeSubscription, now: Date): Date | null {
  if (subscription.status === 'active' || subscription.status === 'trialing') {
    return subscription.currentPeriodEnd.getTime() > now.getTime()
      ? subscription.currentPeriodEnd
      : null;
  }

  if (subscription.status === 'past_due' && subscription.graceExpiresAt) {
    return subscription.graceExpiresAt.getTime() > now.getTime()
      ? subscription.graceExpiresAt
      : null;
  }

  return null;
}

function subscriptionEntitlementRank(subscription: SyncedStripeSubscription): number {
  if (subscription.status === 'active' || subscription.status === 'trialing') {
    return 2;
  }

  if (subscription.status === 'past_due') {
    return 1;
  }

  return 0;
}

function bestEntitledSubscription(
  subscriptions: SyncedStripeSubscription[],
  now: Date,
): { subscription: SyncedStripeSubscription; expiresAt: Date } | null {
  let best: { subscription: SyncedStripeSubscription; expiresAt: Date } | null = null;

  for (const subscription of subscriptions) {
    const expiresAt = subscriptionAccessEnd(subscription, now);
    if (!expiresAt) {
      continue;
    }

    if (!best) {
      best = { subscription, expiresAt };
      continue;
    }

    const rank = subscriptionEntitlementRank(subscription);
    const bestRank = subscriptionEntitlementRank(best.subscription);
    if (
      rank > bestRank ||
      (rank === bestRank && expiresAt.getTime() > best.expiresAt.getTime())
    ) {
      best = { subscription, expiresAt };
    }
  }

  return best;
}

async function reconcileStripeSubscriptionAccess(
  authUserId: string,
  subscriptions: SyncedStripeSubscription[],
  now = new Date(),
): Promise<void> {
  const entitled = bestEntitledSubscription(subscriptions, now);

  await withWriteDb(async (db) => {
    if (!entitled) {
      await expireAccessGrant(db, authUserId, 'stripe_subscription');
      return;
    }

    await upsertAccessGrant(db, {
      authUserId,
      source: 'stripe_subscription',
      grantType: 'subscription',
      expiresAt: entitled.expiresAt,
      sourceReferenceId: entitled.subscription.providerSubscriptionId,
      metadata: {
        plan: entitled.subscription.plan,
        subscriptionStatus: entitled.subscription.status,
      },
    });
  });
}

async function listStripeSubscriptionsForCustomer(
  config: StripeBillingConfig,
  providerCustomerId: string,
  seedSubscriptions: Stripe.Subscription[] = [],
): Promise<Stripe.Subscription[]> {
  const subscriptions = await config.client.subscriptions.list({
    customer: providerCustomerId,
    status: 'all',
    limit: 100,
  });
  const byId = new Map<string, Stripe.Subscription>();
  for (const subscription of seedSubscriptions) {
    byId.set(subscription.id, subscription);
  }
  for (const subscription of subscriptions.data) {
    byId.set(subscription.id, subscription);
  }
  return [...byId.values()];
}

async function syncStripeSubscriptionSet(
  config: StripeBillingConfig,
  authUserId: string,
  providerCustomerId: string,
  options: {
    graceStartBySubscriptionId?: Map<string, Date>;
    seedSubscriptions?: Stripe.Subscription[];
  } = {},
): Promise<void> {
  const subscriptions = await listStripeSubscriptionsForCustomer(
    config,
    providerCustomerId,
    options.seedSubscriptions,
  );
  const syncedSubscriptions: SyncedStripeSubscription[] = [];

  for (const subscription of subscriptions) {
    syncedSubscriptions.push(
      await syncStripeSubscription(
        config,
        subscription,
        authUserId,
        options.graceStartBySubscriptionId?.get(subscription.id),
      ),
    );
  }

  await reconcileStripeSubscriptionAccess(authUserId, syncedSubscriptions);
}

async function syncStripeSubscriptionFamily(
  config: StripeBillingConfig,
  subscription: Stripe.Subscription,
  authUserId?: string,
  graceStartAt?: Date,
): Promise<void> {
  const terms = subscriptionTerms(config, subscription);
  const resolvedAuthUserId = authUserId ?? (await resolveSubscriptionUserId(subscription));
  const graceStartBySubscriptionId = new Map<string, Date>();
  if (graceStartAt) {
    graceStartBySubscriptionId.set(subscription.id, graceStartAt);
  }

  await syncStripeSubscriptionSet(config, resolvedAuthUserId, terms.providerCustomerId, {
    graceStartBySubscriptionId,
    seedSubscriptions: [subscription],
  });
}

function isTime2PaySubscription(
  config: StripeBillingConfig,
  subscription: Stripe.Subscription,
): boolean {
  return subscription.items.data.some(
    (item) =>
      item.price.id === config.priceIds.annual || item.price.id === config.priceIds.monthly,
  );
}

function subscriptionManagementRank(subscription: Stripe.Subscription): number {
  if (subscription.status === 'active' || subscription.status === 'trialing') {
    return 3;
  }
  if (subscription.status === 'past_due') {
    return 2;
  }
  if (subscription.status === 'unpaid' || subscription.status === 'paused') {
    return 1;
  }
  return 0;
}

function assertStripePlanSwitchEligible(subscription: Stripe.Subscription): void {
  if (subscription.status === 'active' || subscription.status === 'trialing') {
    return;
  }

  throw new BillingError(
    409,
    'billing_plan_switch_unavailable',
    'Resolve the current subscription payment status before changing plans.',
  );
}

function manageableStripeSubscription(
  config: StripeBillingConfig,
  subscriptions: Stripe.Subscription[],
): Stripe.Subscription | null {
  return (
    subscriptions
      .filter((subscription) => isTime2PaySubscription(config, subscription))
      .sort((left, right) => {
        const rankDifference =
          subscriptionManagementRank(right) - subscriptionManagementRank(left);
        if (rankDifference !== 0) {
          return rankDifference;
        }
        const leftEnd = subscriptionTerms(config, left).currentPeriodEnd.getTime();
        const rightEnd = subscriptionTerms(config, right).currentPeriodEnd.getTime();
        return rightEnd - leftEnd;
      })[0] ?? null
  );
}

function billingPaymentMethodSummary(
  paymentMethod: Stripe.PaymentMethod | null,
): BillingPaymentMethodSummary | null {
  if (paymentMethod?.type !== 'card' || !paymentMethod.card) {
    return null;
  }

  return {
    brand: paymentMethod.card.brand,
    last4: paymentMethod.card.last4,
    expMonth: paymentMethod.card.exp_month,
    expYear: paymentMethod.card.exp_year,
  };
}

async function defaultPaymentMethodForSubscription(
  config: StripeBillingConfig,
  providerCustomerId: string,
  subscription: Stripe.Subscription,
): Promise<Stripe.PaymentMethod | null> {
  let paymentMethodId = stripeId(subscription.default_payment_method);

  if (!paymentMethodId) {
    const customer = await config.client.customers.retrieve(providerCustomerId);
    if ('deleted' in customer && customer.deleted) {
      return null;
    }
    paymentMethodId = stripeId(customer.invoice_settings.default_payment_method);
  }

  if (paymentMethodId) {
    return config.client.paymentMethods.retrieve(paymentMethodId);
  }

  // Checkout can attach a card to the Stripe customer without setting either
  // default-payment-method field, especially for subscriptions created before
  // we began explicitly assigning a default. Show that saved card when it is
  // safe to do so; only its masked summary is returned to the app.
  const savedCards = await config.client.paymentMethods.list({
    customer: providerCustomerId,
    type: 'card',
    limit: 1,
  });
  return savedCards.data[0] ?? null;
}

async function stripeSubscriptionSummary(
  config: StripeBillingConfig,
  providerCustomerId: string,
  subscription: Stripe.Subscription,
  paymentMethod?: Stripe.PaymentMethod | null,
): Promise<BillingSubscriptionSummary> {
  const terms = subscriptionTerms(config, subscription);
  const resolvedPaymentMethod =
    paymentMethod === undefined
      ? await defaultPaymentMethodForSubscription(config, providerCustomerId, subscription)
      : paymentMethod;
  return {
    plan: terms.plan,
    status: terms.status,
    currentPeriodEnd: terms.currentPeriodEnd.toISOString(),
    cancelAtPeriodEnd: terms.cancelAtPeriodEnd,
    paymentMethod: billingPaymentMethodSummary(resolvedPaymentMethod),
  };
}

export async function getStripeSubscriptionManagement(
  authUserId: string,
): Promise<BillingSubscriptionSummary | null> {
  const config = getStripeBillingConfig();
  const customer = await withWriteDb((db) =>
    getBillingCustomerForUser(db, authUserId, 'stripe'),
  );
  if (!customer) {
    return null;
  }

  const subscriptions = await listStripeSubscriptionsForCustomer(
    config,
    customer.providerCustomerId,
  );
  const subscription = manageableStripeSubscription(config, subscriptions);
  return subscription ? stripeSubscriptionSummary(config, customer.providerCustomerId, subscription) : null;
}

export async function previewStripeSubscriptionPlanSwitch(
  authUserId: string,
  targetPlan: HostedPlan,
): Promise<BillingSubscriptionPlanSwitchPreview> {
  const config = getStripeBillingConfig();
  const { providerCustomerId, subscription } = await manageableStripeSubscriptionForUser(config, authUserId);
  assertStripePlanSwitchEligible(subscription);
  const currentItem = managedSubscriptionItem(config, subscription);
  const currentPlan = planForStripePrice(config, currentItem.price.id);
  const prorationDate = prorationTimestampForSubscriptionItem(currentItem);

  if (currentPlan === targetPlan) {
    return {
      currentPlan,
      targetPlan,
      currency: currentItem.price.currency ?? 'usd',
      prorationDate,
      proratedCreditCents: 0,
      immediateChargeCents: 0,
      amountDueNowCents: 0,
      futureCreditCents: 0,
    };
  }

  let invoice: Stripe.Invoice;
  try {
    invoice = await config.client.invoices.createPreview({
      customer: providerCustomerId,
      subscription: subscription.id,
      subscription_details: {
        cancel_at_period_end: false,
        items: planSwitchSubscriptionItems(config, subscription, targetPlan),
        proration_behavior: 'always_invoice',
        proration_date: prorationDate,
      },
    });
  } catch (error) {
    console.error('Stripe plan-switch preview failed:', error);
    throw new BillingError(
      502,
      'billing_plan_switch_preview_failed',
      'Stripe could not preview this plan change. Please try again.',
    );
  }

  return buildPlanSwitchPreview(config, subscription, targetPlan, invoice, prorationDate);
}

export async function updateStripeSubscriptionManagement(
  authUserId: string,
  request: BillingSubscriptionManagementRequest,
): Promise<BillingSubscriptionSummary> {
  const config = getStripeBillingConfig();
  const { providerCustomerId, subscription } = await manageableStripeSubscriptionForUser(
    config,
    authUserId,
  );

  const baseUpdate = {
    cancel_at_period_end: false,
  } as const;
  let updated: Stripe.Subscription;

  if (request.action === 'cancel_at_period_end') {
    updated = await config.client.subscriptions.update(subscription.id, {
      cancel_at_period_end: true,
    });
  } else if (request.action === 'resume') {
    updated = await config.client.subscriptions.update(subscription.id, baseUpdate);
  } else {
    assertStripePlanSwitchEligible(subscription);
    const currentItem = managedSubscriptionItem(config, subscription);
    const currentPlan = planForStripePrice(config, currentItem.price.id);
    if (currentPlan === request.plan) {
      return stripeSubscriptionSummary(config, providerCustomerId, subscription);
    }

    try {
      updated = await config.client.subscriptions.update(subscription.id, {
        ...baseUpdate,
        items: planSwitchSubscriptionItems(config, subscription, request.plan),
        payment_behavior: 'error_if_incomplete',
        proration_behavior: 'always_invoice',
        proration_date: prorationTimestampForSubscriptionItem(currentItem),
      });
    } catch (error) {
      const statusCode =
        error && typeof error === 'object' && 'statusCode' in error
          ? Number((error as { statusCode?: unknown }).statusCode)
          : null;
      if (statusCode === 402) {
        throw new BillingError(
          402,
          'billing_plan_switch_payment_failed',
          'Stripe could not collect the prorated amount. Update the payment method and try again.',
        );
      }
      throw new BillingError(
        502,
        'billing_plan_switch_failed',
        'Stripe could not change this subscription plan. Please try again.',
      );
    }
  }

  await syncStripeSubscriptionFamily(config, updated, authUserId);
  return stripeSubscriptionSummary(config, providerCustomerId, updated);
}

async function manageableStripeSubscriptionForUser(
  config: StripeBillingConfig,
  authUserId: string,
): Promise<{ providerCustomerId: string; subscription: Stripe.Subscription }> {
  const customer = await withWriteDb((db) =>
    getBillingCustomerForUser(db, authUserId, 'stripe'),
  );
  if (!customer) {
    throw new BillingError(404, 'billing_subscription_missing', 'No Stripe subscription exists for this account.');
  }

  const subscriptions = await listStripeSubscriptionsForCustomer(
    config,
    customer.providerCustomerId,
  );
  const subscription = manageableStripeSubscription(config, subscriptions);
  if (!subscription || subscriptionManagementRank(subscription) === 0) {
    throw new BillingError(
      404,
      'billing_subscription_missing',
      'No manageable Stripe subscription exists for this account.',
    );
  }

  return { providerCustomerId: customer.providerCustomerId, subscription };
}

export async function createStripePaymentMethodSetup(
  authUserId: string,
): Promise<{ clientSecret: string }> {
  const config = getStripeBillingConfig();
  const { providerCustomerId } = await manageableStripeSubscriptionForUser(config, authUserId);
  const setupIntent = await config.client.setupIntents.create({
    customer: providerCustomerId,
    payment_method_types: ['card'],
    usage: 'off_session',
  });

  if (!setupIntent.client_secret) {
    throw new BillingError(
      502,
      'billing_setup_client_secret_missing',
      'Stripe did not return a payment-method update secret. Please try again.',
    );
  }

  return { clientSecret: setupIntent.client_secret };
}

export async function updateStripePaymentMethod(
  authUserId: string,
  paymentMethodId: string,
): Promise<BillingSubscriptionSummary> {
  const config = getStripeBillingConfig();
  const { providerCustomerId, subscription } = await manageableStripeSubscriptionForUser(config, authUserId);
  const paymentMethod = await config.client.paymentMethods.retrieve(paymentMethodId);
  if (paymentMethod.customer !== providerCustomerId || paymentMethod.type !== 'card') {
    throw new BillingError(
      403,
      'billing_payment_method_ineligible',
      'The payment method does not belong to this billing account.',
    );
  }

  await config.client.customers.update(providerCustomerId, {
    invoice_settings: { default_payment_method: paymentMethodId },
  });
  const updatedSubscription = await config.client.subscriptions.update(subscription.id, {
    default_payment_method: paymentMethodId,
  });
  return stripeSubscriptionSummary(config, providerCustomerId, updatedSubscription, paymentMethod);
}

export async function removeStripePaymentMethod(
  authUserId: string,
): Promise<BillingSubscriptionSummary> {
  const config = getStripeBillingConfig();
  const { providerCustomerId, subscription } = await manageableStripeSubscriptionForUser(config, authUserId);
  const requiresRenewalPayment =
    subscription.status === 'active' ||
    subscription.status === 'trialing' ||
    subscription.status === 'past_due';

  if (requiresRenewalPayment && !subscription.cancel_at_period_end) {
    throw new BillingError(
      409,
      'billing_card_required_for_active_subscription',
      'Turn off renewal before removing the saved payment method.',
    );
  }

  const paymentMethod = await defaultPaymentMethodForSubscription(
    config,
    providerCustomerId,
    subscription,
  );
  if (!paymentMethod) {
    return stripeSubscriptionSummary(config, providerCustomerId, subscription, null);
  }

  const paymentMethodCustomerId = stripeId(paymentMethod.customer);
  if (paymentMethodCustomerId !== providerCustomerId || paymentMethod.type !== 'card') {
    throw new BillingError(
      403,
      'billing_payment_method_ineligible',
      'The payment method does not belong to this billing account.',
    );
  }

  const updatedSubscription = await config.client.subscriptions.update(subscription.id, {
    default_payment_method: '',
  });
  await config.client.customers.update(providerCustomerId, {
    invoice_settings: { default_payment_method: '' },
  });
  await config.client.paymentMethods.detach(paymentMethod.id);
  return stripeSubscriptionSummary(config, providerCustomerId, updatedSubscription, null);
}

type StripeLifetimePaymentState = 'paid' | 'unpaid' | 'refunded' | 'disputed';

async function stripeLifetimePaymentState(
  config: StripeBillingConfig,
  paymentIntentId: string,
): Promise<StripeLifetimePaymentState> {
  const paymentIntent = await config.client.paymentIntents.retrieve(paymentIntentId, {
    expand: ['latest_charge'],
  });
  const latestCharge = paymentIntent.latest_charge;
  const charge =
    typeof latestCharge === 'string'
      ? await config.client.charges.retrieve(latestCharge)
      : latestCharge;

  if (charge?.disputed) {
    return 'disputed';
  }
  if (charge?.refunded || (charge?.amount_refunded ?? 0) > 0) {
    return 'refunded';
  }
  if (paymentIntent.status !== 'succeeded' || !charge || charge.paid !== true) {
    return 'unpaid';
  }
  return 'paid';
}

async function syncStripeLifetimeCheckout(
  config: StripeBillingConfig,
  session: Stripe.Checkout.Session,
  authUserId: string,
): Promise<void> {
  if (session.payment_status !== 'paid') {
    return;
  }

  const transactionId = stripeId(session.payment_intent);
  if (!transactionId) {
    throw new BillingError(
      502,
      'billing_transaction_missing',
      'Stripe did not provide a lifetime purchase transaction.',
    );
  }

  const lineItems = await config.client.checkout.sessions.listLineItems(session.id, { limit: 1 });
  const priceId = lineItems.data[0]?.price?.id;
  if (priceId !== priceIdForOffer(config, 'mercury_lifetime')) {
    throw new BillingError(
      400,
      'unsupported_billing_price',
      'The Checkout Session does not contain the Mercury lifetime offer.',
    );
  }

  const paymentState = await stripeLifetimePaymentState(config, transactionId);
  if (paymentState === 'refunded' || paymentState === 'disputed') {
    await updateStripeLifetimePurchaseStatus(
      { payment_intent: transactionId },
      paymentState,
    );
    return;
  }
  if (paymentState !== 'paid') {
    return;
  }

  await withWriteDb(async (db) => {
    await db.transaction(async (transaction) => {
      const billingDb = transaction as unknown as typeof db;
      const purchaseStatus = await upsertBillingPurchase(billingDb, {
        authUserId,
        provider: 'stripe',
        providerTransactionId: transactionId,
        providerProductId: priceId,
        purchaseType: 'lifetime',
        amountCents: session.amount_total ?? 0,
        currency: session.currency ?? 'usd',
        status: 'completed',
        purchasedAt: new Date(session.created * 1000),
      });
      if (purchaseStatus !== 'completed') {
        await revokeAccessGrant(billingDb, authUserId, 'stripe_lifetime', transactionId);
        return;
      }
      await upsertAccessGrant(billingDb, {
        authUserId,
        source: 'stripe_lifetime',
        grantType: 'lifetime',
        expiresAt: null,
        sourceReferenceId: transactionId,
        metadata: { offer: 'mercury_lifetime' },
      });
    });
  });
}

async function syncStripeCheckoutSession(
  config: StripeBillingConfig,
  session: Stripe.Checkout.Session,
  expectedAuthUserId?: string,
): Promise<void> {
  const authUserId = requireAuthUserId(
    session.metadata?.authUserId ?? session.client_reference_id ?? expectedAuthUserId ?? null,
  );
  if (expectedAuthUserId && authUserId !== expectedAuthUserId) {
    throw new BillingError(
      403,
      'billing_identity_mismatch',
      'The Checkout Session belongs to a different Time2Pay account.',
    );
  }

  const providerCustomerId = stripeId(session.customer);
  if (providerCustomerId) {
    const linkedCustomer = await withWriteDb((db) =>
      getBillingCustomerByProviderCustomer(db, 'stripe', providerCustomerId),
    );
    if (linkedCustomer && linkedCustomer.authUserId !== authUserId) {
      throw new BillingError(
        403,
        'billing_identity_mismatch',
        'The Stripe customer belongs to a different Time2Pay account.',
      );
    }
    if (!linkedCustomer) {
      await withWriteDb((db) =>
        upsertBillingCustomer(db, {
          authUserId,
          provider: 'stripe',
          providerCustomerId,
        }),
      );
    }
  }

  if (session.mode === 'subscription') {
    const subscriptionId = stripeId(session.subscription);
    if (!subscriptionId) {
      throw new BillingError(
        502,
        'billing_subscription_missing',
        'Stripe did not provide a subscription for this Checkout Session.',
      );
    }
    const subscription = await config.client.subscriptions.retrieve(subscriptionId);
    await syncStripeSubscriptionFamily(config, subscription, authUserId, new Date(session.created * 1000));
    return;
  }

  if (session.mode === 'payment') {
    await syncStripeLifetimeCheckout(config, session, authUserId);
  }
}

async function syncStripeInvoice(
  config: StripeBillingConfig,
  invoice: Stripe.Invoice,
  graceStartAt?: Date,
): Promise<void> {
  const subscriptionId = stripeId(invoice.parent?.subscription_details?.subscription);
  if (!subscriptionId) {
    return;
  }

  const subscription = await config.client.subscriptions.retrieve(subscriptionId);
  await syncStripeSubscriptionFamily(config, subscription, undefined, graceStartAt);
}

async function updateStripeLifetimePurchaseStatus(
  paymentReference: { payment_intent: string | { id: string } | null },
  status: 'refunded' | 'disputed',
): Promise<void> {
  const transactionId = stripeId(paymentReference.payment_intent);
  if (!transactionId) {
    return;
  }

  await withWriteDb(async (db) => {
    await db.transaction(async (transaction) => {
      const billingDb = transaction as unknown as typeof db;
      const purchase = await updateBillingPurchaseStatus(
        billingDb,
        'stripe',
        transactionId,
        status,
      );
      if (purchase) {
        await revokeAccessGrant(
          billingDb,
          purchase.authUserId,
          'stripe_lifetime',
          transactionId,
        );
      }
    });
  });
}

export async function syncStripeBillingForUser(
  authUserId: string,
  checkoutSessionId?: string,
): Promise<HostedAccessResult> {
  const config = getStripeBillingConfig();
  if (checkoutSessionId?.trim()) {
    const session = await config.client.checkout.sessions.retrieve(checkoutSessionId.trim());
    await syncStripeCheckoutSession(config, session, authUserId);
    return resolveHostedAccess(authUserId);
  }

  const customer = await withWriteDb((db) => getBillingCustomerForUser(db, authUserId, 'stripe'));
  if (!customer) {
    return resolveHostedAccess(authUserId);
  }

  await syncStripeSubscriptionSet(config, authUserId, customer.providerCustomerId);

  return resolveHostedAccess(authUserId);
}

export async function processStripeWebhook(
  rawBody: Buffer,
  signature: string | null,
): Promise<{ duplicate: boolean }> {
  if (!signature) {
    throw new BillingError(400, 'stripe_signature_missing', 'Missing Stripe signature.');
  }

  const config = getStripeBillingConfig();
  let event: Stripe.Event;
  try {
    event = config.client.webhooks.constructEvent(rawBody, signature, getStripeWebhookSecret());
  } catch {
    throw new BillingError(400, 'stripe_signature_invalid', 'Invalid Stripe signature.');
  }

  const claimed = await withWriteDb((db) =>
    claimBillingWebhookEvent(db, {
      provider: 'stripe',
      providerEventId: event.id,
      eventType: event.type,
    }),
  );
  if (!claimed) {
    return { duplicate: true };
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await syncStripeCheckoutSession(config, event.data.object);
        break;
      case 'invoice.paid':
        await syncStripeInvoice(config, event.data.object);
        break;
      case 'invoice.payment_failed':
        await syncStripeInvoice(config, event.data.object, new Date(event.created * 1000));
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await syncStripeSubscriptionFamily(
          config,
          await config.client.subscriptions.retrieve(event.data.object.id),
        );
        break;
      case 'charge.refunded':
        if (event.data.object.refunded) {
          await updateStripeLifetimePurchaseStatus(event.data.object, 'refunded');
        }
        break;
      case 'charge.dispute.created':
        await updateStripeLifetimePurchaseStatus(event.data.object, 'disputed');
        break;
      default:
        break;
    }

    await withWriteDb((db) => markBillingWebhookEventProcessed(db, 'stripe', event.id));
    return { duplicate: false };
  } catch (error) {
    const message = error instanceof BillingError ? error.message : 'Stripe event processing failed.';
    await withWriteDb((db) => markBillingWebhookEventFailed(db, 'stripe', event.id, message));
    throw error;
  }
}
