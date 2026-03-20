import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import { index, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { lifecycleColumns } from '@/database/hosted/shared/schema';

export const userProfiles = pgTable(
  'user_profiles',
  {
    authUserId: uuid('auth_user_id').primaryKey().notNull(),
    id: text('id').notNull().default('me'),
    companyName: text('company_name'),
    logoUrl: text('logo_url'),
    fullName: text('full_name'),
    phone: text('phone'),
    email: text('email'),
    githubPat: text('github_pat'),
    ...lifecycleColumns,
  },
  (table) => ({
    authUserIdIdx: index('idx_user_profiles_auth_user_id').on(table.authUserId),
  }),
);

export const userProfileSelectSchema = createSelectSchema(userProfiles);
export const userProfileInsertSchema = createInsertSchema(userProfiles);
export const userProfileUpdateSchema = createUpdateSchema(userProfiles);

export type UserProfileRow = typeof userProfiles.$inferSelect;
export type NewUserProfileRow = typeof userProfiles.$inferInsert;
