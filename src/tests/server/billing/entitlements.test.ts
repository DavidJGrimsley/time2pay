import { describe, expect, it } from 'vitest';
import type {
  AccessGrantSnapshot,
  BillingSubscriptionSnapshot,
  HostedAccessSnapshot,
} from '@/database/hosted/billing/queries';
import { resolveHostedAccessFromSnapshot } from '@/server/billing/entitlements';

const now = new Date('2026-07-14T12:00:00.000Z');

function accessGrant(overrides: Partial<AccessGrantSnapshot> = {}): AccessGrantSnapshot {
  return {
    source: 'stripe_subscription',
    grantType: 'subscription',
    status: 'active',
    startsAt: new Date('2026-07-01T00:00:00.000Z'),
    expiresAt: new Date('2026-08-01T00:00:00.000Z'),
    revokedAt: null,
    ...overrides,
  };
}

function subscription(
  overrides: Partial<BillingSubscriptionSnapshot> = {},
): BillingSubscriptionSnapshot {
  return {
    provider: 'stripe',
    status: 'active',
    currentPeriodEnd: new Date('2026-08-01T00:00:00.000Z'),
    graceExpiresAt: null,
    ...overrides,
  };
}

function snapshot(overrides: Partial<HostedAccessSnapshot> = {}): HostedAccessSnapshot {
  return {
    grants: [],
    subscriptions: [],
    mercuryReferralStatus: null,
    ...overrides,
  };
}

describe('resolveHostedAccessFromSnapshot', () => {
  it('grants permanent access for a qualified Mercury referral', () => {
    const result = resolveHostedAccessFromSnapshot(
      snapshot({
        grants: [
          accessGrant({
            source: 'mercury_qualified',
            grantType: 'lifetime',
            expiresAt: null,
          }),
        ],
      }),
      now,
    );

    expect(result).toEqual({
      hasAccess: true,
      status: 'active',
      source: 'mercury',
      validUntil: null,
      eligibleOffers: [],
    });
  });

  it('keeps a verified Mercury application usable until its individual deadline', () => {
    const result = resolveHostedAccessFromSnapshot(
      snapshot({
        grants: [
          accessGrant({
            source: 'mercury_pending_grace',
            grantType: 'temporary',
            expiresAt: new Date('2026-10-12T12:00:00.000Z'),
          }),
        ],
      }),
      now,
    );

    expect(result).toMatchObject({
      hasAccess: true,
      status: 'grace',
      source: 'mercury',
      validUntil: '2026-10-12T12:00:00.000Z',
    });
  });

  it('keeps a past-due subscription active during its billing grace period', () => {
    const result = resolveHostedAccessFromSnapshot(
      snapshot({
        grants: [accessGrant()],
        subscriptions: [
          subscription({
            status: 'past_due',
            graceExpiresAt: new Date('2026-07-21T12:00:00.000Z'),
          }),
        ],
      }),
      now,
    );

    expect(result).toMatchObject({
      hasAccess: true,
      status: 'grace',
      source: 'subscription',
      validUntil: '2026-07-21T12:00:00.000Z',
    });
  });

  it('offers the conditional lifetime price only after an eligible Mercury outcome', () => {
    const result = resolveHostedAccessFromSnapshot(
      snapshot({ mercuryReferralStatus: 'failed' }),
      now,
    );

    expect(result).toEqual({
      hasAccess: false,
      status: 'payment_required',
      source: null,
      validUntil: null,
      eligibleOffers: ['annual', 'monthly', 'mercury_lifetime'],
    });
  });

  it('denies revoked access even when a stale grant otherwise looks current', () => {
    const result = resolveHostedAccessFromSnapshot(
      snapshot({ grants: [accessGrant({ status: 'revoked', revokedAt: now })] }),
      now,
    );

    expect(result).toMatchObject({
      hasAccess: false,
      status: 'suspended',
      source: 'subscription',
    });
  });
});