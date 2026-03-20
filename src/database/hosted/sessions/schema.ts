import { sql } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import {
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { clients, projects, tasks } from '@/database/hosted/clients-projects/schema';
import { invoices } from '@/database/hosted/invoices/schema';
import { userProfiles } from '@/database/hosted/profile/schema';
import { lifecycleColumns } from '@/database/hosted/shared/schema';

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey().notNull(),
    authUserId: uuid('auth_user_id').notNull(),
    client: text('client').notNull(),
    clientId: text('client_id'),
    projectId: text('project_id'),
    taskId: text('task_id'),
    startTime: timestamp('start_time', { withTimezone: true }).notNull(),
    endTime: timestamp('end_time', { withTimezone: true }),
    duration: integer('duration'),
    notes: text('notes'),
    commitSha: text('commit_sha'),
    invoiceId: text('invoice_id'),
    ...lifecycleColumns,
  },
  (table) => ({
    authUserIdIdx: index('idx_sessions_auth_user_id').on(table.authUserId),
    startTimeIdx: index('idx_sessions_start_time').on(table.startTime),
    invoiceIdIdx: index('idx_sessions_invoice_id').on(table.invoiceId),
    clientIdIdx: index('idx_sessions_client_id').on(table.clientId),
    projectIdIdx: index('idx_sessions_project_id').on(table.projectId),
    taskIdIdx: index('idx_sessions_task_id').on(table.taskId),
    activeSessionPerUserIdx: uniqueIndex('ux_sessions_active_per_user').on(table.authUserId).where(
      sql`${table.endTime} is null and ${table.deletedAt} is null`,
    ),
    userScopedUnique: uniqueIndex('ux_sessions_id_auth_user_id').on(table.id, table.authUserId),
    authUserFk: foreignKey({
      columns: [table.authUserId],
      foreignColumns: [userProfiles.authUserId],
      name: 'fk_sessions_auth_user_id_user_profiles',
    }).onDelete('cascade'),
    clientUserFk: foreignKey({
      columns: [table.clientId, table.authUserId],
      foreignColumns: [clients.id, clients.authUserId],
      name: 'fk_sessions_client_id_auth_user_id_clients',
    }).onDelete('set null'),
    projectUserFk: foreignKey({
      columns: [table.projectId, table.authUserId],
      foreignColumns: [projects.id, projects.authUserId],
      name: 'fk_sessions_project_id_auth_user_id_projects',
    }).onDelete('set null'),
    taskUserFk: foreignKey({
      columns: [table.taskId, table.authUserId],
      foreignColumns: [tasks.id, tasks.authUserId],
      name: 'fk_sessions_task_id_auth_user_id_tasks',
    }).onDelete('set null'),
    invoiceUserFk: foreignKey({
      columns: [table.invoiceId, table.authUserId],
      foreignColumns: [invoices.id, invoices.authUserId],
      name: 'fk_sessions_invoice_id_auth_user_id_invoices',
    }).onDelete('set null'),
  }),
);

export const sessionBreaks = pgTable(
  'session_breaks',
  {
    id: text('id').primaryKey().notNull(),
    authUserId: uuid('auth_user_id').notNull(),
    sessionId: text('session_id').notNull(),
    startTime: timestamp('start_time', { withTimezone: true }).notNull(),
    endTime: timestamp('end_time', { withTimezone: true }),
    ...lifecycleColumns,
  },
  (table) => ({
    authUserIdIdx: index('idx_session_breaks_auth_user_id').on(table.authUserId),
    sessionIdIdx: index('idx_session_breaks_session_id').on(table.sessionId),
    startTimeIdx: index('idx_session_breaks_start_time').on(table.startTime),
    endTimeIdx: index('idx_session_breaks_end_time').on(table.endTime),
    userScopedUnique: uniqueIndex('ux_session_breaks_id_auth_user_id').on(table.id, table.authUserId),
    authUserFk: foreignKey({
      columns: [table.authUserId],
      foreignColumns: [userProfiles.authUserId],
      name: 'fk_session_breaks_auth_user_id_user_profiles',
    }).onDelete('cascade'),
    sessionUserFk: foreignKey({
      columns: [table.sessionId, table.authUserId],
      foreignColumns: [sessions.id, sessions.authUserId],
      name: 'fk_session_breaks_session_id_auth_user_id_sessions',
    }).onDelete('cascade'),
  }),
);

export const sessionSelectSchema = createSelectSchema(sessions);
export const sessionInsertSchema = createInsertSchema(sessions);
export const sessionUpdateSchema = createUpdateSchema(sessions);

export const sessionBreakSelectSchema = createSelectSchema(sessionBreaks);
export const sessionBreakInsertSchema = createInsertSchema(sessionBreaks);
export const sessionBreakUpdateSchema = createUpdateSchema(sessionBreaks);

export type SessionRow = typeof sessions.$inferSelect;
export type NewSessionRow = typeof sessions.$inferInsert;
export type SessionBreakRow = typeof sessionBreaks.$inferSelect;
export type NewSessionBreakRow = typeof sessionBreaks.$inferInsert;
