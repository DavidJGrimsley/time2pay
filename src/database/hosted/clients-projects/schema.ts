import { sql } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import {
  check,
  foreignKey,
  index,
  numeric,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { userProfiles } from '@/database/hosted/profile/schema';
import { lifecycleColumns } from '@/database/hosted/shared/schema';

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
    pricingModeCheck: check(
      'projects_pricing_mode_check',
      sql`${table.pricingMode} in ('hourly', 'milestone')`,
    ),
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

export const clientSelectSchema = createSelectSchema(clients);
export const clientInsertSchema = createInsertSchema(clients);
export const clientUpdateSchema = createUpdateSchema(clients);

export const projectSelectSchema = createSelectSchema(projects);
export const projectInsertSchema = createInsertSchema(projects);
export const projectUpdateSchema = createUpdateSchema(projects);

export const taskSelectSchema = createSelectSchema(tasks);
export const taskInsertSchema = createInsertSchema(tasks);
export const taskUpdateSchema = createUpdateSchema(tasks);

export type ClientRow = typeof clients.$inferSelect;
export type NewClientRow = typeof clients.$inferInsert;
export type ProjectRow = typeof projects.$inferSelect;
export type NewProjectRow = typeof projects.$inferInsert;
export type TaskRow = typeof tasks.$inferSelect;
export type NewTaskRow = typeof tasks.$inferInsert;
