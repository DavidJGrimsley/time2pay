import { sql } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import { check, foreignKey, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { invoices } from '@/database/hosted/invoices/schema';
import { userProfiles } from '@/database/hosted/profile/schema';
import { sessions } from '@/database/hosted/sessions/schema';

export const invoiceSessionLinks = pgTable(
  'invoice_session_links',
  {
    id: text('id').primaryKey().notNull(),
    authUserId: uuid('auth_user_id').notNull(),
    invoiceId: text('invoice_id').notNull(),
    sessionId: text('session_id').notNull(),
    linkMode: text('link_mode').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    authUserIdIdx: index('idx_invoice_session_links_auth_user_id').on(table.authUserId),
    invoiceIdIdx: index('idx_invoice_session_links_invoice_id').on(table.invoiceId),
    sessionIdIdx: index('idx_invoice_session_links_session_id').on(table.sessionId),
    userScopedUnique: uniqueIndex('ux_invoice_session_links_id_auth_user_id').on(
      table.id,
      table.authUserId,
    ),
    invoiceSessionUserUnique: uniqueIndex('ux_invoice_session_links_invoice_session_auth_user').on(
      table.invoiceId,
      table.sessionId,
      table.authUserId,
    ),
    linkModeCheck: check(
      'invoice_session_links_link_mode_check',
      sql`${table.linkMode} in ('context', 'billed')`,
    ),
    authUserFk: foreignKey({
      columns: [table.authUserId],
      foreignColumns: [userProfiles.authUserId],
      name: 'fk_invoice_session_links_auth_user_id_user_profiles',
    }).onDelete('cascade'),
    invoiceUserFk: foreignKey({
      columns: [table.invoiceId, table.authUserId],
      foreignColumns: [invoices.id, invoices.authUserId],
      name: 'fk_invoice_session_links_invoice_id_auth_user_id_invoices',
    }).onDelete('cascade'),
    sessionUserFk: foreignKey({
      columns: [table.sessionId, table.authUserId],
      foreignColumns: [sessions.id, sessions.authUserId],
      name: 'fk_invoice_session_links_session_id_auth_user_id_sessions',
    }).onDelete('cascade'),
  }),
);

export const invoiceSessionLinkSelectSchema = createSelectSchema(invoiceSessionLinks);
export const invoiceSessionLinkInsertSchema = createInsertSchema(invoiceSessionLinks);
export const invoiceSessionLinkUpdateSchema = createUpdateSchema(invoiceSessionLinks);

export type InvoiceSessionLinkRow = typeof invoiceSessionLinks.$inferSelect;
export type NewInvoiceSessionLinkRow = typeof invoiceSessionLinks.$inferInsert;
