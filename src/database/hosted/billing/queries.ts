import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import {
  accessGrants,
  billingCustomers,
  billingPurchases,
  billingSubscriptions,
  type AccessGrantRow,
  type BillingSubscriptionRow,
} from '@/database/hosted/billing/schema';
import { HOSTED_ENTITLEMENT_KEY } from '@/database/hosted/billing/types';
import type {
  AccessGrantSource,
  AccessGrantStatus,
  AccessGrantType,
  BillingProvider,
  BillingPurchaseStatus,
  BillingPurchaseType,
  BillingSubscriptionStatus,
  HostedPlan,
} from '@/database/hosted/billing/types';
import { mercuryReferrals } from '@/database/hosted/mercury/schema';
import * as hostedSchema from '@/database/hosted/schema';

export type HostedBillingDb = PostgresJsDatabase<typeof hostedSchema>;

export type AccessGrantSnapshot = Pick<
  AccessGrantRow,
  'source' | 'grantType' | 'status' | 'startsAt' | 'expiresAt' | 'revokedAt'
>;

export type BillingSubscriptionSnapshot = Pick<
  BillingSubscriptionRow,
  'provider' | 'status' | 'currentPeriodEnd' | 'graceExpiresAt'
>;

export type HostedAccessSnapshot = {
  grants: AccessGrantSnapshot[];
  subscriptions: BillingSubscriptionSnapshot[];
  mercuryReferralStatus: string | null;
};

export type UpsertAccessGrantInput = {
  authUserId: string;
  source: AccessGrantSource;
  grantType: AccessGrantType;
  status?: AccessGrantStatus;
  startsAt?: Date;
  expiresAt?: Date | null;
  revokedAt?: Date | null;
  sourceReferenceId?: string | null;
  metadata?: Record<string, unknown>;
};

export type BillingCustomerSnapshot = {
  providerCustomerId: string;
};

export type UpsertBillingCustomerInput = {
  authUserId: string;
  provider: BillingProvider;
  providerCustomerId: string;
};

export type UpsertBillingSubscriptionInput = {
  authUserId: string;
  provider: BillingProvider;
  providerCustomerId: string;
  providerSubscriptionId: string;
  providerProductId: string;
  plan: HostedPlan;
  status: BillingSubscriptionStatus;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  graceExpiresAt?: Date | null;
  cancelAtPeriodEnd?: boolean;
  canceledAt?: Date | null;
};

export type UpsertBillingPurchaseInput = {
  authUserId: string;
  provider: BillingProvider;
  providerTransactionId: string;
  providerProductId: string;
  purchaseType: BillingPurchaseType;
  amountCents: number;
  currency: string;
  status: BillingPurchaseStatus;
  purchasedAt: Date;
  refundedAt?: Date | null;
};

type QueryResultRow = Record<string, unknown>;

function rowsFromResult(result: unknown): QueryResultRow[] {
  if (Array.isArray(result)) {
    return result as QueryResultRow[];
  }

  if (result && typeof result === 'object') {
    const rows = (result as { rows?: unknown[] }).rows;
    if (Array.isArray(rows)) {
      return rows as QueryResultRow[];
    }
  }

  return [];
}

function toDatabaseTimestamp(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

export async function getBillingCustomerForUser(
  db: HostedBillingDb,
  authUserId: string,
  provider: BillingProvider,
): Promise<BillingCustomerSnapshot | null> {
  const customers = await db
    .select({ providerCustomerId: billingCustomers.providerCustomerId })
    .from(billingCustomers)
    .where(
      and(
        eq(billingCustomers.authUserId, authUserId),
        eq(billingCustomers.provider, provider),
      ),
    )
    .limit(1);

  return customers[0] ?? null;
}

export async function getBillingCustomerByProviderCustomer(
  db: HostedBillingDb,
  provider: BillingProvider,
  providerCustomerId: string,
): Promise<{ authUserId: string } | null> {
  const customers = await db
    .select({ authUserId: billingCustomers.authUserId })
    .from(billingCustomers)
    .where(
      and(
        eq(billingCustomers.provider, provider),
        eq(billingCustomers.providerCustomerId, providerCustomerId),
      ),
    )
    .limit(1);

  return customers[0] ?? null;
}

async function ensureBillingProfileRow(db: HostedBillingDb, authUserId: string): Promise<void> {
  await db.execute(sql`
    insert into user_profiles (auth_user_id)
    values (${authUserId}::uuid)
    on conflict (auth_user_id) do nothing
  `);
}

export async function upsertBillingCustomer(
  db: HostedBillingDb,
  input: UpsertBillingCustomerInput,
): Promise<void> {
  const timestamp = new Date().toISOString();
  await ensureBillingProfileRow(db, input.authUserId);
  await db.execute(sql`
    insert into billing_customers (
      auth_user_id,
      provider,
      provider_customer_id,
      created_at,
      updated_at
    ) values (
      ${input.authUserId}::uuid,
      ${input.provider},
      ${input.providerCustomerId},
      ${timestamp},
      ${timestamp}
    )
    on conflict (auth_user_id, provider) do update set
      provider_customer_id = excluded.provider_customer_id,
      updated_at = excluded.updated_at
  `);
}

export async function upsertBillingSubscription(
  db: HostedBillingDb,
  input: UpsertBillingSubscriptionInput,
): Promise<void> {
  const timestamp = new Date().toISOString();
  await db.execute(sql`
    insert into billing_subscriptions (
      auth_user_id,
      provider,
      provider_customer_id,
      provider_subscription_id,
      provider_product_id,
      plan,
      status,
      current_period_start,
      current_period_end,
      grace_expires_at,
      cancel_at_period_end,
      canceled_at,
      created_at,
      updated_at
    ) values (
      ${input.authUserId}::uuid,
      ${input.provider},
      ${input.providerCustomerId},
      ${input.providerSubscriptionId},
      ${input.providerProductId},
      ${input.plan},
      ${input.status},
      ${toDatabaseTimestamp(input.currentPeriodStart)},
      ${toDatabaseTimestamp(input.currentPeriodEnd)},
      ${toDatabaseTimestamp(input.graceExpiresAt)},
      ${input.cancelAtPeriodEnd ?? false},
      ${toDatabaseTimestamp(input.canceledAt)},
      ${timestamp},
      ${timestamp}
    )
    on conflict (provider, provider_subscription_id) do update set
      auth_user_id = excluded.auth_user_id,
      provider_customer_id = excluded.provider_customer_id,
      provider_product_id = excluded.provider_product_id,
      plan = excluded.plan,
      status = excluded.status,
      current_period_start = excluded.current_period_start,
      current_period_end = excluded.current_period_end,
      grace_expires_at = excluded.grace_expires_at,
      cancel_at_period_end = excluded.cancel_at_period_end,
      canceled_at = excluded.canceled_at,
      updated_at = excluded.updated_at
  `);
}

export async function getBillingSubscriptionByProviderSubscription(
  db: HostedBillingDb,
  provider: BillingProvider,
  providerSubscriptionId: string,
): Promise<{ graceExpiresAt: Date | null; status: BillingSubscriptionStatus } | null> {
  const subscriptions = await db
    .select({
      graceExpiresAt: billingSubscriptions.graceExpiresAt,
      status: billingSubscriptions.status,
    })
    .from(billingSubscriptions)
    .where(
      and(
        eq(billingSubscriptions.provider, provider),
        eq(billingSubscriptions.providerSubscriptionId, providerSubscriptionId),
      ),
    )
    .limit(1);

  const subscription = subscriptions[0];
  if (!subscription) {
    return null;
  }

  return {
    graceExpiresAt: subscription.graceExpiresAt,
    status: subscription.status as BillingSubscriptionStatus,
  };
}

export async function upsertBillingPurchase(
  db: HostedBillingDb,
  input: UpsertBillingPurchaseInput,
): Promise<void> {
  const timestamp = new Date().toISOString();
  await db.execute(sql`
    insert into billing_purchases (
      auth_user_id,
      provider,
      provider_transaction_id,
      provider_product_id,
      purchase_type,
      amount_cents,
      currency,
      status,
      purchased_at,
      refunded_at,
      created_at,
      updated_at
    ) values (
      ${input.authUserId}::uuid,
      ${input.provider},
      ${input.providerTransactionId},
      ${input.providerProductId},
      ${input.purchaseType},
      ${input.amountCents},
      ${input.currency.toLowerCase()},
      ${input.status},
      ${toDatabaseTimestamp(input.purchasedAt)},
      ${toDatabaseTimestamp(input.refundedAt)},
      ${timestamp},
      ${timestamp}
    )
    on conflict (provider, provider_transaction_id) do update set
      auth_user_id = excluded.auth_user_id,
      provider_product_id = excluded.provider_product_id,
      purchase_type = excluded.purchase_type,
      amount_cents = excluded.amount_cents,
      currency = excluded.currency,
      status = excluded.status,
      purchased_at = excluded.purchased_at,
      refunded_at = excluded.refunded_at,
      updated_at = excluded.updated_at
  `);
}

export async function getBillingPurchaseByProviderTransaction(
  db: HostedBillingDb,
  provider: BillingProvider,
  providerTransactionId: string,
): Promise<{ authUserId: string } | null> {
  const purchases = await db
    .select({ authUserId: billingPurchases.authUserId })
    .from(billingPurchases)
    .where(
      and(
        eq(billingPurchases.provider, provider),
        eq(billingPurchases.providerTransactionId, providerTransactionId),
      ),
    )
    .limit(1);

  return purchases[0] ?? null;
}

export async function updateBillingPurchaseStatus(
  db: HostedBillingDb,
  provider: BillingProvider,
  providerTransactionId: string,
  status: Extract<BillingPurchaseStatus, 'refunded' | 'disputed'>,
): Promise<{ authUserId: string } | null> {
  const timestamp = new Date().toISOString();
  const result = await db.execute(sql`
    update billing_purchases
    set
      status = ${status},
      refunded_at = case when ${status} = 'refunded' then ${timestamp} else refunded_at end,
      updated_at = ${timestamp}
    where provider = ${provider}
      and provider_transaction_id = ${providerTransactionId}
    returning auth_user_id
  `);
  const row = rowsFromResult(result)[0];
  const authUserId = typeof row?.auth_user_id === 'string' ? row.auth_user_id : null;
  return authUserId ? { authUserId } : null;
}

export async function claimBillingWebhookEvent(
  db: HostedBillingDb,
  input: {
    provider: BillingProvider;
    providerEventId: string;
    eventType: string;
  },
): Promise<boolean> {
  const timestamp = new Date().toISOString();
  const result = await db.execute(sql`
    insert into billing_webhook_events (
      provider,
      provider_event_id,
      event_type,
      status,
      received_at,
      created_at,
      updated_at
    ) values (
      ${input.provider},
      ${input.providerEventId},
      ${input.eventType},
      'received',
      ${timestamp},
      ${timestamp},
      ${timestamp}
    )
    on conflict (provider, provider_event_id) do update set
      status = 'received',
      received_at = excluded.received_at,
      processed_at = null,
      error_message = null,
      updated_at = excluded.updated_at
    where billing_webhook_events.status = 'failed'
    returning id
  `);

  return rowsFromResult(result).length > 0;
}

export async function markBillingWebhookEventProcessed(
  db: HostedBillingDb,
  provider: BillingProvider,
  providerEventId: string,
): Promise<void> {
  const timestamp = new Date().toISOString();
  await db.execute(sql`
    update billing_webhook_events
    set
      status = 'processed',
      processed_at = ${timestamp},
      error_message = null,
      updated_at = ${timestamp}
    where provider = ${provider}
      and provider_event_id = ${providerEventId}
  `);
}

export async function markBillingWebhookEventFailed(
  db: HostedBillingDb,
  provider: BillingProvider,
  providerEventId: string,
  errorMessage: string,
): Promise<void> {
  const timestamp = new Date().toISOString();
  await db.execute(sql`
    update billing_webhook_events
    set
      status = 'failed',
      error_message = ${errorMessage.slice(0, 500)},
      updated_at = ${timestamp}
    where provider = ${provider}
      and provider_event_id = ${providerEventId}
  `);
}

export async function upsertAccessGrant(
  db: HostedBillingDb,
  input: UpsertAccessGrantInput,
): Promise<void> {
  const timestamp = new Date().toISOString();
  const startsAt = toDatabaseTimestamp(input.startsAt) ?? timestamp;
  const metadata = JSON.stringify(input.metadata ?? {});

  await db.execute(sql`
    insert into access_grants (
      auth_user_id,
      entitlement_key,
      source,
      grant_type,
      status,
      starts_at,
      expires_at,
      revoked_at,
      source_reference_id,
      metadata,
      created_at,
      updated_at
    ) values (
      ${input.authUserId}::uuid,
      ${HOSTED_ENTITLEMENT_KEY},
      ${input.source},
      ${input.grantType},
      ${input.status ?? 'active'},
      ${startsAt},
      ${toDatabaseTimestamp(input.expiresAt)},
      ${toDatabaseTimestamp(input.revokedAt)},
      ${input.sourceReferenceId ?? null},
      ${metadata}::jsonb,
      ${timestamp},
      ${timestamp}
    )
    on conflict (auth_user_id, entitlement_key, source) do update set
      grant_type = excluded.grant_type,
      status = excluded.status,
      starts_at = excluded.starts_at,
      expires_at = excluded.expires_at,
      revoked_at = excluded.revoked_at,
      source_reference_id = excluded.source_reference_id,
      metadata = excluded.metadata,
      updated_at = excluded.updated_at
  `);
}

export async function expireAccessGrant(
  db: HostedBillingDb,
  authUserId: string,
  source: AccessGrantSource,
): Promise<void> {
  const timestamp = new Date().toISOString();
  await db.execute(sql`
    update access_grants
    set
      status = 'expired',
      expires_at = ${timestamp},
      updated_at = ${timestamp}
    where auth_user_id = ${authUserId}::uuid
      and entitlement_key = ${HOSTED_ENTITLEMENT_KEY}
      and source = ${source}
      and status = 'active'
  `);
}

export async function revokeAccessGrant(
  db: HostedBillingDb,
  authUserId: string,
  source: AccessGrantSource,
): Promise<void> {
  const timestamp = new Date().toISOString();
  await db.execute(sql`
    update access_grants
    set
      status = 'revoked',
      revoked_at = ${timestamp},
      updated_at = ${timestamp}
    where auth_user_id = ${authUserId}::uuid
      and entitlement_key = ${HOSTED_ENTITLEMENT_KEY}
      and status = 'active'
      and source = ${source}
  `);
}

export async function getHostedAccessSnapshot(
  db: HostedBillingDb,
  authUserId: string,
): Promise<HostedAccessSnapshot> {
  const [grants, subscriptions, referrals] = await Promise.all([
    db
      .select({
        source: accessGrants.source,
        grantType: accessGrants.grantType,
        status: accessGrants.status,
        startsAt: accessGrants.startsAt,
        expiresAt: accessGrants.expiresAt,
        revokedAt: accessGrants.revokedAt,
      })
      .from(accessGrants)
      .where(
        and(
          eq(accessGrants.authUserId, authUserId),
          eq(accessGrants.entitlementKey, HOSTED_ENTITLEMENT_KEY),
        ),
      ),
    db
      .select({
        provider: billingSubscriptions.provider,
        status: billingSubscriptions.status,
        currentPeriodEnd: billingSubscriptions.currentPeriodEnd,
        graceExpiresAt: billingSubscriptions.graceExpiresAt,
      })
      .from(billingSubscriptions)
      .where(eq(billingSubscriptions.authUserId, authUserId))
      .orderBy(desc(billingSubscriptions.updatedAt)),
    db
      .select({ status: mercuryReferrals.status })
      .from(mercuryReferrals)
      .where(
        and(
          eq(mercuryReferrals.authUserId, authUserId),
          isNull(mercuryReferrals.deletedAt),
        ),
      )
      .limit(1),
  ]);

  return {
    grants,
    subscriptions,
    mercuryReferralStatus: referrals[0]?.status ?? null,
  };
}