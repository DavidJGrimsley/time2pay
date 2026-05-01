import { sql } from 'drizzle-orm';
import { check, foreignKey, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
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

export const mercuryReferrals = pgTable(
  'mercury_referrals',
  {
    authUserId: uuid('auth_user_id').primaryKey().notNull(),
    referralUrl: text('referral_url').notNull().default('https://mercury.com/partner/time2pay'),
    clickCount: integer('click_count').notNull().default(0),
    firstClickedAt: timestamp('first_clicked_at', { withTimezone: true }),
    lastClickedAt: timestamp('last_clicked_at', { withTimezone: true }),
    status: text('status').notNull().default('clicked'),
    adminNotes: text('admin_notes'),
    premiumAccessGrantedAt: timestamp('premium_access_granted_at', { withTimezone: true }),
    ...lifecycleColumns,
  },
  (table) => ({
    authUserIdIdx: index('idx_mercury_referrals_auth_user_id').on(table.authUserId),
    statusIdx: index('idx_mercury_referrals_status').on(table.status),
    premiumAccessGrantedAtIdx: index('idx_mercury_referrals_premium_access_granted_at').on(
      table.premiumAccessGrantedAt,
    ),
    statusCheck: check(
      'mercury_referrals_status_check',
      sql`${table.status} in ('clicked', 'pending_review', 'qualified', 'rejected')`,
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
