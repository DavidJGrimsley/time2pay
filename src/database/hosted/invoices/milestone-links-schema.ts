import { sql } from 'drizzle-orm';
import { numeric, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

export const invoiceMilestoneLinks = pgTable('invoice_milestone_links', {
  id: text('id').primaryKey().notNull(),
  authUserId: uuid('auth_user_id').notNull(),
  invoiceId: text('invoice_id').notNull(),
  milestoneId: text('milestone_id').notNull(),
  projectId: text('project_id').notNull(),
  projectName: text('project_name'),
  title: text('title').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  amountType: text('amount_type').notNull(),
  amountValue: numeric('amount_value', { precision: 12, scale: 2 }).notNull(),
  completionMode: text('completion_mode').notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => ({
  activeMilestone: uniqueIndex('ux_invoice_milestone_links_active_milestone')
    .on(table.milestoneId)
    .where(sql`${table.deletedAt} is null`),
  invoiceMilestone: uniqueIndex('ux_invoice_milestone_links_invoice_milestone').on(table.invoiceId, table.milestoneId),
}));
