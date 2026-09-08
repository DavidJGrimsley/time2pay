import {
  getHostedAccessSnapshot,
  type AccessGrantSnapshot,
  type BillingSubscriptionSnapshot,
  type HostedAccessSnapshot,
} from '@/database/hosted/billing/queries';
import type {
  HostedAccessResult,
  HostedAccessSource,
  HostedOffer,
} from '@/database/hosted/billing/types';
import { withWriteDb } from '@/server/db/_shared/db';
import { forbidden } from '@/server/db/_shared/errors';

const MERCURY_LIFETIME_ELIGIBLE_STATUSES = new Set([
  'failed',
  'expired',
  'existing_customer',
]);

function toDate(value: Date | string | null): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

function toIsoString(value: Date | string | null): string | null {
  const parsed = toDate(value);
  return parsed ? parsed.toISOString() : null;
}

function isAtOrBefore(value: Date | string | null, now: Date): boolean {
  const parsed = toDate(value);
  return parsed ? parsed.getTime() <= now.getTime() : false;
}

function isAfter(value: Date | string | null, now: Date): boolean {
  const parsed = toDate(value);
  return parsed ? parsed.getTime() > now.getTime() : false;
}

function isActiveGrant(grant: AccessGrantSnapshot, now: Date): boolean {
  return (
    grant.status === 'active' &&
    grant.revokedAt === null &&
    isAtOrBefore(grant.startsAt, now) &&
    (grant.expiresAt === null || isAfter(grant.expiresAt, now))
  );
}

function accessSourceForGrant(grant: AccessGrantSnapshot): HostedAccessSource {
  if (grant.source === 'mercury_qualified' || grant.source === 'mercury_pending_grace') {
    return 'mercury';
  }

  if (grant.source === 'admin') {
    return 'admin';
  }

  return grant.grantType === 'lifetime' ? 'lifetime_purchase' : 'subscription';
}

function publicOffersForReferralStatus(referralStatus: string | null): HostedOffer[] {
  const offers: HostedOffer[] = ['annual', 'monthly'];
  if (referralStatus && MERCURY_LIFETIME_ELIGIBLE_STATUSES.has(referralStatus)) {
    offers.push('mercury_lifetime');
  }
  return offers;
}

function hasPastDueGrace(
  subscription: BillingSubscriptionSnapshot | undefined,
  now: Date,
): boolean {
  return subscription?.status === 'past_due' && isAfter(subscription.graceExpiresAt, now);
}

function matchingSubscription(
  grant: AccessGrantSnapshot,
  subscriptions: BillingSubscriptionSnapshot[],
): BillingSubscriptionSnapshot | undefined {
  const provider = grant.source.replace('_subscription', '');
  return subscriptions.find((subscription) => subscription.provider === provider);
}

export function resolveHostedAccessFromSnapshot(
  snapshot: HostedAccessSnapshot,
  now = new Date(),
): HostedAccessResult {
  const activeGrants = snapshot.grants.filter((grant) => isActiveGrant(grant, now));
  const lastingGrant = activeGrants.find(
    (grant) => grant.grantType === 'lifetime' || grant.source === 'admin',
  );

  if (lastingGrant) {
    return {
      hasAccess: true,
      status: 'active',
      source: accessSourceForGrant(lastingGrant),
      validUntil: null,
      eligibleOffers: [],
    };
  }

  const mercuryGraceGrant = activeGrants.find(
    (grant) => grant.source === 'mercury_pending_grace',
  );
  if (mercuryGraceGrant) {
    return {
      hasAccess: true,
      status: 'grace',
      source: 'mercury',
      validUntil: toIsoString(mercuryGraceGrant.expiresAt),
      eligibleOffers: [],
    };
  }

  const subscriptionGrant = activeGrants.find((grant) => grant.grantType === 'subscription');
  if (subscriptionGrant) {
    const subscription = matchingSubscription(subscriptionGrant, snapshot.subscriptions);
    const inGrace = hasPastDueGrace(subscription, now);
    return {
      hasAccess: true,
      status: inGrace ? 'grace' : 'active',
      source: 'subscription',
      validUntil: inGrace
        ? toIsoString(subscription?.graceExpiresAt ?? null)
        : toIsoString(subscriptionGrant.expiresAt) ?? toIsoString(subscription?.currentPeriodEnd ?? null),
      eligibleOffers: [],
    };
  }

  const pastDueSubscription = snapshot.subscriptions.find(
    (subscription) => subscription.status === 'past_due',
  );
  if (pastDueSubscription) {
    return {
      hasAccess: false,
      status: 'past_due',
      source: 'subscription',
      validUntil:
        toIsoString(pastDueSubscription.graceExpiresAt) ??
        toIsoString(pastDueSubscription.currentPeriodEnd),
      eligibleOffers: publicOffersForReferralStatus(snapshot.mercuryReferralStatus),
    };
  }

  const suspendedSubscription = snapshot.subscriptions.find(
    (subscription) => subscription.status === 'unpaid' || subscription.status === 'paused',
  );
  const revokedGrant = snapshot.grants.find((grant) => grant.status === 'revoked');
  if (suspendedSubscription || revokedGrant) {
    return {
      hasAccess: false,
      status: 'suspended',
      source: suspendedSubscription ? 'subscription' : accessSourceForGrant(revokedGrant!),
      validUntil: null,
      eligibleOffers: publicOffersForReferralStatus(snapshot.mercuryReferralStatus),
    };
  }

  return {
    hasAccess: false,
    status: 'payment_required',
    source: null,
    validUntil: null,
    eligibleOffers: publicOffersForReferralStatus(snapshot.mercuryReferralStatus),
  };
}

export async function resolveHostedAccess(authUserId: string): Promise<HostedAccessResult> {
  return withWriteDb(async (db) => {
    const snapshot = await getHostedAccessSnapshot(db, authUserId);
    return resolveHostedAccessFromSnapshot(snapshot);
  });
}

export function isHostedAccessEnforcementEnabled(): boolean {
  const dataMode = process.env.EXPO_PUBLIC_TIME2PAY_DATA_MODE?.trim().toLowerCase();
  const enabled = process.env.TIME2PAY_ENFORCE_HOSTED_ACCESS?.trim().toLowerCase();
  return dataMode === 'hosted' && enabled === 'true';
}

export async function requireHostedAccess(authUserId: string): Promise<HostedAccessResult> {
  const result = await resolveHostedAccess(authUserId);
  if (!result.hasAccess) {
    throw forbidden('Hosted access is required for this action.');
  }
  return result;
}