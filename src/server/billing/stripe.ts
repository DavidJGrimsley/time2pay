import Stripe from 'stripe';
import type { HostedOffer } from '@/database/hosted/billing/types';
import { BillingError } from '@/server/billing/errors';

export type StripeBillingConfig = {
  client: Stripe;
  siteOrigin: string;
  priceIds: Record<HostedOffer, string>;
  gracePeriodDays: number;
};

function requiredEnvironmentValue(key: string): string {
  const value = process.env[key]?.trim() ?? '';
  if (!value) {
    throw new BillingError(501, 'billing_not_configured', `Set ${key} to enable hosted billing.`);
  }
  return value;
}

function parseHostedSiteOrigin(): string {
  const rawOrigin = requiredEnvironmentValue('EXPO_PUBLIC_SITE_ORIGIN');
  let parsed: URL;
  try {
    parsed = new URL(rawOrigin);
  } catch {
    throw new BillingError(
      500,
      'billing_configuration_error',
      'EXPO_PUBLIC_SITE_ORIGIN must be a valid absolute URL.',
    );
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new BillingError(
      500,
      'billing_configuration_error',
      'EXPO_PUBLIC_SITE_ORIGIN must use http:// or https://.',
    );
  }

  if ((parsed.pathname !== '/' && parsed.pathname !== '') || parsed.search || parsed.hash) {
    throw new BillingError(
      500,
      'billing_configuration_error',
      'EXPO_PUBLIC_SITE_ORIGIN must not include a path, query, or fragment.',
    );
  }

  return parsed.origin;
}

function readGracePeriodDays(): number {
  const rawValue = process.env.TIME2PAY_BILLING_GRACE_DAYS?.trim();
  if (!rawValue) {
    return 7;
  }

  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 31) {
    throw new BillingError(
      500,
      'billing_configuration_error',
      'TIME2PAY_BILLING_GRACE_DAYS must be an integer from 0 to 31.',
    );
  }

  return parsed;
}

export function getStripeBillingConfig(): StripeBillingConfig {
  const secretKey = requiredEnvironmentValue('STRIPE_SECRET_KEY');
  return {
    client: new Stripe(secretKey),
    siteOrigin: parseHostedSiteOrigin(),
    priceIds: {
      annual: requiredEnvironmentValue('STRIPE_PRICE_HOSTED_ANNUAL'),
      monthly: requiredEnvironmentValue('STRIPE_PRICE_HOSTED_MONTHLY'),
      mercury_lifetime: requiredEnvironmentValue('STRIPE_PRICE_MERCURY_LIFETIME'),
    },
    gracePeriodDays: readGracePeriodDays(),
  };
}

export function getStripeWebhookSecret(): string {
  return requiredEnvironmentValue('STRIPE_WEBHOOK_SECRET');
}
