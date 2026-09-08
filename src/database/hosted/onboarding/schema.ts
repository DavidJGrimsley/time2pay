import { sql } from 'drizzle-orm';
import {
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
import { lifecycleColumns } from '@/database/hosted/shared/schema';

export const userOnboardingState = pgTable(
  'user_onboarding_state',
  {
    authUserId: uuid('auth_user_id').primaryKey().notNull(),
    flowId: text('flow_id').notNull(),
    flowVersion: integer('flow_version').notNull().default(1),
    completedStepIds: jsonb('completed_step_ids').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    ...lifecycleColumns,
  },
  (table) => ({
    flowIdx: index('idx_user_onboarding_state_flow').on(table.flowId, table.flowVersion),
    completedAtIdx: index('idx_user_onboarding_state_completed_at').on(table.completedAt),
    authUserFk: foreignKey({
      columns: [table.authUserId],
      foreignColumns: [userProfiles.authUserId],
      name: 'fk_user_onboarding_state_auth_user_id_user_profiles',
    }).onDelete('cascade'),
  }),
);

export const userOnboardingEvents = pgTable(
  'user_onboarding_events',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    authUserId: uuid('auth_user_id').notNull(),
    flowId: text('flow_id').notNull(),
    flowVersion: integer('flow_version').notNull().default(1),
    stepId: text('step_id').notNull(),
    eventType: text('event_type').notNull(),
    answerKey: text('answer_key'),
    answerValue: jsonb('answer_value').$type<unknown>(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  },
  (table) => ({
    authUserOccurredAtIdx: index('idx_user_onboarding_events_user_occurred_at').on(
      table.authUserId,
      table.occurredAt,
    ),
    authUserStepIdx: index('idx_user_onboarding_events_user_step').on(
      table.authUserId,
      table.stepId,
    ),
    eventTypeCheck: check(
      'user_onboarding_events_event_type_check',
      sql`${table.eventType} in ('step_completed', 'answer_selected', 'legal_accepted', 'flow_completed', 'backfilled')`,
    ),
    authUserFk: foreignKey({
      columns: [table.authUserId],
      foreignColumns: [userProfiles.authUserId],
      name: 'fk_user_onboarding_events_auth_user_id_user_profiles',
    }).onDelete('cascade'),
  }),
);

export const userLegalAcceptances = pgTable(
  'user_legal_acceptances',
  {
    id: uuid('id').primaryKey().notNull().defaultRandom(),
    authUserId: uuid('auth_user_id').notNull(),
    documentId: text('document_id').notNull(),
    documentVersion: text('document_version').notNull(),
    flowId: text('flow_id'),
    flowVersion: integer('flow_version'),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }).defaultNow().notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  },
  (table) => ({
    authUserDocumentIdx: index('idx_user_legal_acceptances_user_document').on(
      table.authUserId,
      table.documentId,
    ),
    acceptedAtIdx: index('idx_user_legal_acceptances_accepted_at').on(table.acceptedAt),
    authUserDocumentVersionUnique: uniqueIndex('ux_user_legal_acceptances_user_document_version').on(
      table.authUserId,
      table.documentId,
      table.documentVersion,
    ),
    authUserFk: foreignKey({
      columns: [table.authUserId],
      foreignColumns: [userProfiles.authUserId],
      name: 'fk_user_legal_acceptances_auth_user_id_user_profiles',
    }).onDelete('cascade'),
  }),
);

export type UserOnboardingStateRow = typeof userOnboardingState.$inferSelect;
export type NewUserOnboardingStateRow = typeof userOnboardingState.$inferInsert;
export type UserOnboardingEventRow = typeof userOnboardingEvents.$inferSelect;
export type NewUserOnboardingEventRow = typeof userOnboardingEvents.$inferInsert;
export type UserLegalAcceptanceRow = typeof userLegalAcceptances.$inferSelect;
export type NewUserLegalAcceptanceRow = typeof userLegalAcceptances.$inferInsert;
