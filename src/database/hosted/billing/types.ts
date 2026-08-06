export const HOSTED_ENTITLEMENT_KEY = 'hosted_time2pay' as const;

export const BILLING_PROVIDERS = ['stripe', 'apple', 'google', 'revenuecat'] as const;
export type BillingProvider = (typeof BILLING_PROVIDERS)[number];

export const HOSTED_PLANS = ['monthly', 'annual'] as const;
export type HostedPlan = (typeof HOSTED_PLANS)[number];

export const BILLING_SUBSCRIPTION_STATUSES = [
  'active',
  'trialing',
  'past_due',
  'canceled',
  'unpaid',
  'incomplete',
  'incomplete_expired',
  'paused',
] as const;
export type BillingSubscriptionStatus = (typeof BILLING_SUBSCRIPTION_STATUSES)[number];

export const BILLING_PURCHASE_TYPES = ['lifetime'] as const;
export type BillingPurchaseType = (typeof BILLING_PURCHASE_TYPES)[number];

export const BILLING_PURCHASE_STATUSES = ['completed', 'pending', 'refunded', 'disputed'] as const;
export type BillingPurchaseStatus = (typeof BILLING_PURCHASE_STATUSES)[number];

export const BILLING_WEBHOOK_EVENT_STATUSES = ['received', 'processed', 'failed'] as const;
export type BillingWebhookEventStatus = (typeof BILLING_WEBHOOK_EVENT_STATUSES)[number];

export const ACCESS_GRANT_SOURCES = [
  'stripe_subscription',
  'stripe_lifetime',
  'apple_subscription',
  'apple_lifetime',
  'google_subscription',
  'google_lifetime',
  'mercury_qualified',
  'mercury_pending_grace',
  'admin',
] as const;
export type AccessGrantSource = (typeof ACCESS_GRANT_SOURCES)[number];

export const ACCESS_GRANT_TYPES = ['subscription', 'lifetime', 'temporary'] as const;
export type AccessGrantType = (typeof ACCESS_GRANT_TYPES)[number];

export const ACCESS_GRANT_STATUSES = ['active', 'expired', 'revoked'] as const;
export type AccessGrantStatus = (typeof ACCESS_GRANT_STATUSES)[number];

export const HOSTED_ACCESS_STATUSES = [
  'active',
  'grace',
  'payment_required',
  'past_due',
  'suspended',
] as const;
export type HostedAccessStatus = (typeof HOSTED_ACCESS_STATUSES)[number];

export const HOSTED_ACCESS_SOURCES = ['subscription', 'lifetime_purchase', 'mercury', 'admin'] as const;
export type HostedAccessSource = (typeof HOSTED_ACCESS_SOURCES)[number] | null;

export const HOSTED_OFFERS = ['monthly', 'annual', 'mercury_lifetime'] as const;
export type HostedOffer = (typeof HOSTED_OFFERS)[number];

export const BILLING_SUBSCRIPTION_ACTIONS = ['cancel_at_period_end', 'resume'] as const;
export type BillingSubscriptionAction = (typeof BILLING_SUBSCRIPTION_ACTIONS)[number];

export type BillingSubscriptionManagementRequest =
  | { action: 'cancel_at_period_end' }
  | { action: 'resume' }
  | { action: 'switch_plan'; plan: HostedPlan };

export type BillingSubscriptionPlanSwitchPreview = {
  currentPlan: HostedPlan;
  targetPlan: HostedPlan;
  currency: string;
  prorationDate: number;
  proratedCreditCents: number;
  immediateChargeCents: number;
  amountDueNowCents: number;
  futureCreditCents: number;
};

export type BillingPaymentMethodSummary = {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
};

export type BillingSubscriptionSummary = {
  plan: HostedPlan;
  status: BillingSubscriptionStatus;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  paymentMethod: BillingPaymentMethodSummary | null;
};

export type HostedAccessResult = {
  hasAccess: boolean;
  status: HostedAccessStatus;
  source: HostedAccessSource;
  validUntil: string | null;
  eligibleOffers: HostedOffer[];
};
