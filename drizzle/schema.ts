import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

const lifecycleColumns = {
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
};

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

export const clients = pgTable(
  'clients',
  {
    id: text('id').primaryKey().notNull(),
    authUserId: uuid('auth_user_id').notNull(),
    name: text('name').notNull(),
    email: text('email'),
    phone: text('phone'),
    hourlyRate: numeric('hourly_rate', { precision: 12, scale: 2 }).notNull().default('0'),
    githubOrg: text('github_org'),
    ...lifecycleColumns,
  },
  (table) => ({
    authUserIdIdx: index('idx_clients_auth_user_id').on(table.authUserId),
    userScopedUnique: uniqueIndex('ux_clients_id_auth_user_id').on(table.id, table.authUserId),
    authUserFk: foreignKey({
      columns: [table.authUserId],
      foreignColumns: [userProfiles.authUserId],
      name: 'fk_clients_auth_user_id_user_profiles',
    }).onDelete('cascade'),
  }),
);

export const projects = pgTable(
  'projects',
  {
    id: text('id').primaryKey().notNull(),
    authUserId: uuid('auth_user_id').notNull(),
    clientId: text('client_id').notNull(),
    name: text('name').notNull(),
    githubRepo: text('github_repo'),
    pricingMode: text('pricing_mode').notNull().default('hourly'),
    totalProjectFee: numeric('total_project_fee', { precision: 12, scale: 2 }),
    ...lifecycleColumns,
  },
  (table) => ({
    authUserIdIdx: index('idx_projects_auth_user_id').on(table.authUserId),
    clientIdIdx: index('idx_projects_client_id').on(table.clientId),
    pricingModeIdx: index('idx_projects_pricing_mode').on(table.pricingMode),
    userScopedUnique: uniqueIndex('ux_projects_id_auth_user_id').on(table.id, table.authUserId),
    pricingModeCheck: check('projects_pricing_mode_check', sql`${table.pricingMode} in ('hourly', 'milestone')`),
    authUserFk: foreignKey({
      columns: [table.authUserId],
      foreignColumns: [userProfiles.authUserId],
      name: 'fk_projects_auth_user_id_user_profiles',
    }).onDelete('cascade'),
    clientUserFk: foreignKey({
      columns: [table.clientId, table.authUserId],
      foreignColumns: [clients.id, clients.authUserId],
      name: 'fk_projects_client_id_auth_user_id_clients',
    }).onDelete('cascade'),
  }),
);

export const tasks = pgTable(
  'tasks',
  {
    id: text('id').primaryKey().notNull(),
    authUserId: uuid('auth_user_id').notNull(),
    projectId: text('project_id').notNull(),
    name: text('name').notNull(),
    githubBranch: text('github_branch'),
    ...lifecycleColumns,
  },
  (table) => ({
    authUserIdIdx: index('idx_tasks_auth_user_id').on(table.authUserId),
    projectIdIdx: index('idx_tasks_project_id').on(table.projectId),
    userScopedUnique: uniqueIndex('ux_tasks_id_auth_user_id').on(table.id, table.authUserId),
    authUserFk: foreignKey({
      columns: [table.authUserId],
      foreignColumns: [userProfiles.authUserId],
      name: 'fk_tasks_auth_user_id_user_profiles',
    }).onDelete('cascade'),
    projectUserFk: foreignKey({
      columns: [table.projectId, table.authUserId],
      foreignColumns: [projects.id, projects.authUserId],
      name: 'fk_tasks_project_id_auth_user_id_projects',
    }).onDelete('cascade'),
  }),
);

export const projectMilestones = pgTable(
  'project_milestones',
  {
    id: text('id').primaryKey().notNull(),
    authUserId: uuid('auth_user_id').notNull(),
    projectId: text('project_id').notNull(),
    title: text('title').notNull(),
    amountType: text('amount_type').notNull(),
    amountValue: numeric('amount_value', { precision: 12, scale: 2 }).notNull(),
    completionMode: text('completion_mode').notNull(),
    dueNote: text('due_note'),
    sortOrder: integer('sort_order').notNull().default(0),
    isCompleted: boolean('is_completed').notNull().default(false),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    ...lifecycleColumns,
  },
  (table) => ({
    authUserIdIdx: index('idx_project_milestones_auth_user_id').on(table.authUserId),
    projectIdIdx: index('idx_project_milestones_project_id').on(table.projectId),
    sortOrderIdx: index('idx_project_milestones_sort_order').on(table.sortOrder),
    userScopedUnique: uniqueIndex('ux_project_milestones_id_auth_user_id').on(
      table.id,
      table.authUserId,
    ),
    amountTypeCheck: check(
      'project_milestones_amount_type_check',
      sql`${table.amountType} in ('percent', 'fixed')`,
    ),
    completionModeCheck: check(
      'project_milestones_completion_mode_check',
      sql`${table.completionMode} in ('toggle', 'checklist')`,
    ),
    authUserFk: foreignKey({
      columns: [table.authUserId],
      foreignColumns: [userProfiles.authUserId],
      name: 'fk_project_milestones_auth_user_id_user_profiles',
    }).onDelete('cascade'),
    projectUserFk: foreignKey({
      columns: [table.projectId, table.authUserId],
      foreignColumns: [projects.id, projects.authUserId],
      name: 'fk_project_milestones_project_id_auth_user_id_projects',
    }).onDelete('cascade'),
  }),
);

export const milestoneChecklistItems = pgTable(
  'milestone_checklist_items',
  {
    id: text('id').primaryKey().notNull(),
    authUserId: uuid('auth_user_id').notNull(),
    milestoneId: text('milestone_id').notNull(),
    label: text('label').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    isCompleted: boolean('is_completed').notNull().default(false),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    ...lifecycleColumns,
  },
  (table) => ({
    authUserIdIdx: index('idx_milestone_checklist_items_auth_user_id').on(table.authUserId),
    milestoneIdIdx: index('idx_milestone_checklist_items_milestone_id').on(table.milestoneId),
    userScopedUnique: uniqueIndex('ux_milestone_checklist_items_id_auth_user_id').on(
      table.id,
      table.authUserId,
    ),
    authUserFk: foreignKey({
      columns: [table.authUserId],
      foreignColumns: [userProfiles.authUserId],
      name: 'fk_milestone_checklist_items_auth_user_id_user_profiles',
    }).onDelete('cascade'),
    milestoneUserFk: foreignKey({
      columns: [table.milestoneId, table.authUserId],
      foreignColumns: [projectMilestones.id, projectMilestones.authUserId],
      name: 'fk_milestone_checklist_items_milestone_id_auth_user_id_project_milestones',
    }).onDelete('cascade'),
  }),
);

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
    statusCheck: check('invoices_status_check', sql`${table.status} in ('draft', 'sent', 'paid', 'overdue')`),
    invoiceTypeCheck: check('invoices_invoice_type_check', sql`${table.invoiceType} in ('hourly', 'milestone')`),
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
