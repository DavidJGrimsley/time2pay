import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { userProfiles } from '@/database/hosted/profile/schema';
import { lifecycleColumns } from '@/database/hosted/shared/schema';

export const mercuryCredentials = pgTable(
  'mercury_credentials',
  {
    authUserId: uuid('auth_user_id').primaryKey().notNull(),
    encryptedApiKey: text('encrypted_api_key'),
    iv: text('iv'),
    authTag: text('auth_tag'),
    keyLastFour: text('key_last_four'),
    vaultSecretId: uuid('vault_secret_id'),
    arAccessAvailable: boolean('ar_access_available'),
    arAccessVerifiedAt: timestamp('ar_access_verified_at', { withTimezone: true }),
    ...lifecycleColumns,
  },
  (table) => ({
    authUserIdIdx: index('idx_mercury_credentials_auth_user_id').on(table.authUserId),
    authUserFk: foreignKey({
      columns: [table.authUserId],
      foreignColumns: [userProfiles.authUserId],
      name: 'fk_mercury_credentials_auth_user_id_user_profiles',
    }).onDelete('cascade'),
  }),
);

export const mercuryCredentialHistory = pgTable(
  'mercury_credential_history',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    authUserId: uuid('auth_user_id').notNull(),
    vaultSecretId: uuid('vault_secret_id'),
    keyLastFour: text('key_last_four'),
    retiredAt: timestamp('retired_at', { withTimezone: true }).defaultNow().notNull(),
    retiredReason: text('retired_reason').notNull(),
  },
  (table) => ({
    authUserIdIdx: index('idx_mercury_credential_history_auth_user_id').on(table.authUserId),
    retiredAtIdx: index('idx_mercury_credential_history_retired_at').on(table.retiredAt),
    retiredReasonCheck: check(
      'mercury_credential_history_retired_reason_check',
      sql`${table.retiredReason} in ('rotated', 'deleted')`,
    ),
    authUserFk: foreignKey({
      columns: [table.authUserId],
      foreignColumns: [userProfiles.authUserId],
      name: 'fk_mercury_credential_history_auth_user_id_user_profiles',
    }).onDelete('cascade'),
  }),
);

export const mercuryCredentialEvents = pgTable(
  'mercury_credential_events',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    authUserId: uuid('auth_user_id').notNull(),
    action: text('action').notNull(),
    keyLastFour: text('key_last_four'),
    success: boolean('success'),
    errorCode: text('error_code'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    authUserIdOccurredAtIdx: index('idx_mercury_credential_events_user_occurred_at').on(
      table.authUserId,
      table.occurredAt,
    ),
    actionCheck: check(
      'mercury_credential_events_action_check',
      sql`${table.action} in ('created', 'rotated', 'tested', 'deleted', 'ar_probed')`,
    ),
    authUserFk: foreignKey({
      columns: [table.authUserId],
      foreignColumns: [userProfiles.authUserId],
      name: 'fk_mercury_credential_events_auth_user_id_user_profiles',
    }).onDelete('cascade'),
  }),
);

export const mercuryReferrals = pgTable(
  'mercury_referrals',
  {
    authUserId: uuid('auth_user_id').primaryKey().notNull(),
    referralUrl: text('referral_url').notNull().default('https://mercury.com/partner/time2pay'),
    clickCount: integer('click_count').notNull().default(0),
    firstClickedAt: timestamp('first_clicked_at', { withTimezone: true }),
    lastClickedAt: timestamp('last_clicked_at', { withTimezone: true }),
    applicationStartedAt: timestamp('application_started_at', { withTimezone: true }),
    qualificationDeadlineAt: timestamp('qualification_deadline_at', { withTimezone: true }),
    qualifiedAt: timestamp('qualified_at', { withTimezone: true }),
    failedAt: timestamp('failed_at', { withTimezone: true }),
    expiredAt: timestamp('expired_at', { withTimezone: true }),
    verificationSource: text('verification_source'),
    externalReference: text('external_reference'),
    verifiedBy: text('verified_by'),
    status: text('status').notNull().default('not_started'),
    adminNotes: text('admin_notes'),
    premiumAccessGrantedAt: timestamp('premium_access_granted_at', { withTimezone: true }),
    ...lifecycleColumns,
  },
  (table) => ({
    authUserIdIdx: index('idx_mercury_referrals_auth_user_id').on(table.authUserId),
    statusIdx: index('idx_mercury_referrals_status').on(table.status),
    qualificationDeadlineIdx: index('idx_mercury_referrals_qualification_deadline').on(
      table.qualificationDeadlineAt,
    ),
    premiumAccessGrantedAtIdx: index('idx_mercury_referrals_premium_access_granted_at').on(
      table.premiumAccessGrantedAt,
    ),
    statusCheck: check(
      'mercury_referrals_status_check',
      sql`${table.status} in ('not_started', 'clicked', 'application_started', 'pending_qualification', 'qualified', 'failed', 'expired', 'existing_customer')`,
    ),
    authUserFk: foreignKey({
      columns: [table.authUserId],
      foreignColumns: [userProfiles.authUserId],
      name: 'fk_mercury_referrals_auth_user_id_user_profiles',
    }).onDelete('cascade'),
  }),
);

export type MercuryCredentialRow = typeof mercuryCredentials.$inferSelect;
export type NewMercuryCredentialRow = typeof mercuryCredentials.$inferInsert;
export type MercuryReferralRow = typeof mercuryReferrals.$inferSelect;
export type NewMercuryReferralRow = typeof mercuryReferrals.$inferInsert;
export type MercuryCredentialHistoryRow = typeof mercuryCredentialHistory.$inferSelect;
export type NewMercuryCredentialHistoryRow = typeof mercuryCredentialHistory.$inferInsert;
export type MercuryCredentialEventRow = typeof mercuryCredentialEvents.$inferSelect;
export type NewMercuryCredentialEventRow = typeof mercuryCredentialEvents.$inferInsert;
