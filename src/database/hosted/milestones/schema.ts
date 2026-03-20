import { sql } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod';
import {
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
  boolean,
} from 'drizzle-orm/pg-core';
import { projects } from '@/database/hosted/clients-projects/schema';
import { userProfiles } from '@/database/hosted/profile/schema';
import { lifecycleColumns } from '@/database/hosted/shared/schema';

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

export const projectMilestoneSelectSchema = createSelectSchema(projectMilestones);
export const projectMilestoneInsertSchema = createInsertSchema(projectMilestones);
export const projectMilestoneUpdateSchema = createUpdateSchema(projectMilestones);

export const milestoneChecklistItemSelectSchema = createSelectSchema(milestoneChecklistItems);
export const milestoneChecklistItemInsertSchema = createInsertSchema(milestoneChecklistItems);
export const milestoneChecklistItemUpdateSchema = createUpdateSchema(milestoneChecklistItems);

export type ProjectMilestoneRow = typeof projectMilestones.$inferSelect;
export type NewProjectMilestoneRow = typeof projectMilestones.$inferInsert;
export type MilestoneChecklistItemRow = typeof milestoneChecklistItems.$inferSelect;
export type NewMilestoneChecklistItemRow = typeof milestoneChecklistItems.$inferInsert;
