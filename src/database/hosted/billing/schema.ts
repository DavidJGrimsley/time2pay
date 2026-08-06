import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { userProfiles } from '@/database/hosted/profile/schema';

const billingTimestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
};

export const billingCustomers = pgTable(
  'billing_customers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    authUserId: uuid('auth_user_id').notNull(),
    provider: text('provider').notNull(),
    providerCustomerId: text('provider_customer_id').notNull(),
    ...billingTimestamps,
  },
  (table) => ({
    authUserIdIdx: index('idx_billing_customers_auth_user_id').on(table.authUserId),
    authUserProviderUnique: uniqueIndex('ux_billing_customers_auth_user_provider').on(
      table.authUserId,
      table.provider,
    ),
    providerCustomerUnique: uniqueIndex('ux_billing_customers_provider_customer').on(
      table.provider,
      table.providerCustomerId,
    ),
    providerCheck: check(
      'billing_customers_provider_check',
      sql`${table.provider} in ('stripe', 'apple', 'google', 'revenuecat')`,
    ),
    authUserFk: foreignKey({
      columns: [table.authUserId],
      foreignColumns: [userProfiles.authUserId],
      name: 'fk_billing_customers_auth_user_id_user_profiles',
    }).onDelete('cascade'),
  }),
);

export const billingSubscriptions = pgTable(
  'billing_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    authUserId: uuid('auth_user_id').notNull(),
    provider: text('provider').notNull(),
    providerCustomerId: text('provider_customer_id').notNull(),
    providerSubscriptionId: text('provider_subscription_id').notNull(),
    providerProductId: text('provider_product_id').notNull(),
    plan: text('plan').notNull(),
    status: text('status').notNull(),
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    graceExpiresAt: timestamp('grace_expires_at', { withTimezone: true }),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false).notNull(),
    canceledAt: timestamp('canceled_at', { withTimezone: true }),
    ...billingTimestamps,
  },
  (table) => ({
    authUserStatusIdx: index('idx_billing_subscriptions_auth_user_status').on(
      table.authUserId,
      table.status,
    ),
    authUserPeriodEndIdx: index('idx_billing_subscriptions_auth_user_period_end').on(
      table.authUserId,
      table.currentPeriodEnd,
    ),
    providerSubscriptionUnique: uniqueIndex('ux_billing_subscriptions_provider_subscription').on(
      table.provider,
      table.providerSubscriptionId,
    ),
    providerCheck: check(
      'billing_subscriptions_provider_check',
      sql`${table.provider} in ('stripe', 'apple', 'google', 'revenuecat')`,
    ),
    planCheck: check(
      'billing_subscriptions_plan_check',
      sql`${table.plan} in ('monthly', 'annual')`,
    ),
    statusCheck: check(
      'billing_subscriptions_status_check',
      sql`${table.status} in ('active', 'trialing', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused')`,
    ),
    authUserFk: foreignKey({
      columns: [table.authUserId],
      foreignColumns: [userProfiles.authUserId],
      name: 'fk_billing_subscriptions_auth_user_id_user_profiles',
    }).onDelete('cascade'),
  }),
);

export const billingPurchases = pgTable(
  'billing_purchases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    authUserId: uuid('auth_user_id').notNull(),
    provider: text('provider').notNull(),
    providerTransactionId: text('provider_transaction_id').notNull(),
    providerProductId: text('provider_product_id').notNull(),
    purchaseType: text('purchase_type').notNull(),
    amountCents: integer('amount_cents').notNull(),
    currency: text('currency').notNull(),
    status: text('status').notNull(),
    purchasedAt: timestamp('purchased_at', { withTimezone: true }).notNull(),
    refundedAt: timestamp('refunded_at', { withTimezone: true }),
    ...billingTimestamps,
  },
  (table) => ({
    authUserStatusIdx: index('idx_billing_purchases_auth_user_status').on(
      table.authUserId,
      table.status,
    ),
    providerTransactionUnique: uniqueIndex('ux_billing_purchases_provider_transaction').on(
      table.provider,
      table.providerTransactionId,
    ),
    providerCheck: check(
      'billing_purchases_provider_check',
      sql`${table.provider} in ('stripe', 'apple', 'google', 'revenuecat')`,
    ),
    purchaseTypeCheck: check(
      'billing_purchases_type_check',
      sql`${table.purchaseType} in ('lifetime')`,
    ),
    statusCheck: check(
      'billing_purchases_status_check',
      sql`${table.status} in ('completed', 'pending', 'refunded', 'disputed')`,
    ),
    authUserFk: foreignKey({
      columns: [table.authUserId],
      foreignColumns: [userProfiles.authUserId],
      name: 'fk_billing_purchases_auth_user_id_user_profiles',
    }).onDelete('cascade'),
  }),
);

export const billingWebhookEvents = pgTable(
  'billing_webhook_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    provider: text('provider').notNull(),
    providerEventId: text('provider_event_id').notNull(),
    eventType: text('event_type').notNull(),
    status: text('status').notNull().default('received'),
    receivedAt: timestamp('received_at', { withTimezone: true }).defaultNow().notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    errorMessage: text('error_message'),
    ...billingTimestamps,
  },
  (table) => ({
    providerEventUnique: uniqueIndex('ux_billing_webhook_events_provider_event').on(
      table.provider,
      table.providerEventId,
    ),
    statusReceivedIdx: index('idx_billing_webhook_events_status_received').on(
      table.status,
      table.receivedAt,
    ),
    providerCheck: check(
      'billing_webhook_events_provider_check',
      sql`${table.provider} in ('stripe', 'apple', 'google', 'revenuecat')`,
    ),
    statusCheck: check(
      'billing_webhook_events_status_check',
      sql`${table.status} in ('received', 'processed', 'failed')`,
    ),
  }),
);

export const accessGrants = pgTable(
  'access_grants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    authUserId: uuid('auth_user_id').notNull(),
    entitlementKey: text('entitlement_key').notNull(),
    source: text('source').notNull(),
    grantType: text('grant_type').notNull(),
    status: text('status').notNull().default('active'),
    startsAt: timestamp('starts_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    sourceReferenceId: text('source_reference_id'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    ...billingTimestamps,
  },
  (table) => ({
    authUserEntitlementStatusIdx: index('idx_access_grants_user_entitlement_status').on(
      table.authUserId,
      table.entitlementKey,
      table.status,
    ),
    authUserExpiryIdx: index('idx_access_grants_auth_user_expiry').on(
      table.authUserId,
      table.expiresAt,
    ),
    authUserEntitlementSourceUnique: uniqueIndex('ux_access_grants_user_entitlement_source').on(
      table.authUserId,
      table.entitlementKey,
      table.source,
    ),
    sourceReferenceIdx: index('idx_access_grants_source_reference').on(
      table.source,
      table.sourceReferenceId,
    ),
    sourceCheck: check(
      'access_grants_source_check',
      sql`${table.source} in ('stripe_subscription', 'stripe_lifetime', 'apple_subscription', 'apple_lifetime', 'google_subscription', 'google_lifetime', 'mercury_qualified', 'mercury_pending_grace', 'admin')`,
    ),
    grantTypeCheck: check(
      'access_grants_grant_type_check',
      sql`${table.grantType} in ('subscription', 'lifetime', 'temporary')`,
    ),
    statusCheck: check(
      'access_grants_status_check',
      sql`${table.status} in ('active', 'expired', 'revoked')`,
    ),
    lifetimeExpiryCheck: check(
      'access_grants_lifetime_expiry_check',
      sql`${table.grantType} <> 'lifetime' or ${table.expiresAt} is null`,
    ),
    authUserFk: foreignKey({
      columns: [table.authUserId],
      foreignColumns: [userProfiles.authUserId],
      name: 'fk_access_grants_auth_user_id_user_profiles',
    }).onDelete('cascade'),
  }),
);

export type BillingCustomerRow = typeof billingCustomers.$inferSelect;
export type NewBillingCustomerRow = typeof billingCustomers.$inferInsert;
export type BillingSubscriptionRow = typeof billingSubscriptions.$inferSelect;
export type NewBillingSubscriptionRow = typeof billingSubscriptions.$inferInsert;
export type BillingPurchaseRow = typeof billingPurchases.$inferSelect;
export type NewBillingPurchaseRow = typeof billingPurchases.$inferInsert;
export type BillingWebhookEventRow = typeof billingWebhookEvents.$inferSelect;
export type NewBillingWebhookEventRow = typeof billingWebhookEvents.$inferInsert;
export type AccessGrantRow = typeof accessGrants.$inferSelect;
export type NewAccessGrantRow = typeof accessGrants.$inferInsert;