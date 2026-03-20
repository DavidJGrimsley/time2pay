import { sql } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import {
  check,
  foreignKey,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { clients, projects } from '@/database/hosted/clients-projects/schema';
import { projectMilestones } from '@/database/hosted/milestones/schema';
import { userProfiles } from '@/database/hosted/profile/schema';
import { lifecycleColumns } from '@/database/hosted/shared/schema';

export const invoices = pgTable(
  'invoices',
  {
    id: text('id').primaryKey().notNull(),
    authUserId: uuid('auth_user_id').notNull(),
    clientId: text('client_id').notNull(),
    total: numeric('total', { precision: 12, scale: 2 }).notNull().default('0'),
    status: text('status').notNull().default('draft'),
    invoiceType: text('invoice_type').notNull().default('hourly'),
    mercuryInvoiceId: text('mercury_invoice_id'),
    paymentLink: text('payment_link'),
    sourceProjectId: text('source_project_id'),
    sourceProjectName: text('source_project_name'),
    sourceMilestoneId: text('source_milestone_id'),
    sourceMilestoneTitle: text('source_milestone_title'),
    sourceMilestoneAmountType: text('source_milestone_amount_type'),
    sourceMilestoneAmountValue: numeric('source_milestone_amount_value', { precision: 12, scale: 2 }),
    sourceMilestoneCompletionMode: text('source_milestone_completion_mode'),
    sourceMilestoneCompletedAt: timestamp('source_milestone_completed_at', { withTimezone: true }),
    sourceSessionLinkMode: text('source_session_link_mode'),
    sourceSessionHourlyRate: numeric('source_session_hourly_rate', { precision: 12, scale: 2 }),
    ...lifecycleColumns,
  },
  (table) => ({
    authUserIdIdx: index('idx_invoices_auth_user_id').on(table.authUserId),
    clientIdIdx: index('idx_invoices_client_id').on(table.clientId),
    userScopedUnique: uniqueIndex('ux_invoices_id_auth_user_id').on(table.id, table.authUserId),
    statusCheck: check(
      'invoices_status_check',
      sql`${table.status} in ('draft', 'sent', 'paid', 'overdue')`,
    ),
    invoiceTypeCheck: check(
      'invoices_invoice_type_check',
      sql`${table.invoiceType} in ('hourly', 'milestone')`,
    ),
    sourceMilestoneAmountTypeCheck: check(
      'invoices_source_milestone_amount_type_check',
      sql`${table.sourceMilestoneAmountType} is null or ${table.sourceMilestoneAmountType} in ('percent', 'fixed')`,
    ),
    sourceMilestoneCompletionModeCheck: check(
      'invoices_source_milestone_completion_mode_check',
      sql`${table.sourceMilestoneCompletionMode} is null or ${table.sourceMilestoneCompletionMode} in ('toggle', 'checklist')`,
    ),
    sourceSessionLinkModeCheck: check(
      'invoices_source_session_link_mode_check',
      sql`${table.sourceSessionLinkMode} is null or ${table.sourceSessionLinkMode} in ('context', 'billed')`,
    ),
    authUserFk: foreignKey({
      columns: [table.authUserId],
      foreignColumns: [userProfiles.authUserId],
      name: 'fk_invoices_auth_user_id_user_profiles',
    }).onDelete('cascade'),
    clientUserFk: foreignKey({
      columns: [table.clientId, table.authUserId],
      foreignColumns: [clients.id, clients.authUserId],
      name: 'fk_invoices_client_id_auth_user_id_clients',
    }).onDelete('cascade'),
    sourceProjectUserFk: foreignKey({
      columns: [table.sourceProjectId, table.authUserId],
      foreignColumns: [projects.id, projects.authUserId],
      name: 'fk_invoices_source_project_id_auth_user_id_projects',
    }).onDelete('set null'),
    sourceMilestoneUserFk: foreignKey({
      columns: [table.sourceMilestoneId, table.authUserId],
      foreignColumns: [projectMilestones.id, projectMilestones.authUserId],
      name: 'fk_invoices_source_milestone_id_auth_user_id_project_milestones',
    }).onDelete('set null'),
  }),
);

export const invoiceSelectSchema = createSelectSchema(invoices);
export const invoiceInsertSchema = createInsertSchema(invoices);
export const invoiceUpdateSchema = createUpdateSchema(invoices);

export type InvoiceRow = typeof invoices.$inferSelect;
export type NewInvoiceRow = typeof invoices.$inferInsert;
