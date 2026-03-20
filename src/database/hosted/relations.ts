import { relations } from 'drizzle-orm';
import { clients, projects, tasks } from '@/database/hosted/clients-projects/schema';
import { invoiceSessionLinks } from '@/database/hosted/invoice-session-links/schema';
import { invoices } from '@/database/hosted/invoices/schema';
import { milestoneChecklistItems, projectMilestones } from '@/database/hosted/milestones/schema';
import { userProfiles } from '@/database/hosted/profile/schema';
import { sessionBreaks, sessions } from '@/database/hosted/sessions/schema';

export const userProfilesRelations = relations(userProfiles, ({ many }) => ({
  clients: many(clients),
  projects: many(projects),
  tasks: many(tasks),
  projectMilestones: many(projectMilestones),
  milestoneChecklistItems: many(milestoneChecklistItems),
  invoices: many(invoices),
  sessions: many(sessions),
  sessionBreaks: many(sessionBreaks),
  invoiceSessionLinks: many(invoiceSessionLinks),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  userProfile: one(userProfiles, {
    fields: [clients.authUserId],
    references: [userProfiles.authUserId],
  }),
  projects: many(projects),
  sessions: many(sessions),
  invoices: many(invoices),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  userProfile: one(userProfiles, {
    fields: [projects.authUserId],
    references: [userProfiles.authUserId],
  }),
  client: one(clients, {
    fields: [projects.clientId, projects.authUserId],
    references: [clients.id, clients.authUserId],
  }),
  tasks: many(tasks),
  milestones: many(projectMilestones),
  sessions: many(sessions),
  invoicesFromSource: many(invoices),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  userProfile: one(userProfiles, {
    fields: [tasks.authUserId],
    references: [userProfiles.authUserId],
  }),
  project: one(projects, {
    fields: [tasks.projectId, tasks.authUserId],
    references: [projects.id, projects.authUserId],
  }),
  sessions: many(sessions),
}));

export const projectMilestonesRelations = relations(projectMilestones, ({ one, many }) => ({
  userProfile: one(userProfiles, {
    fields: [projectMilestones.authUserId],
    references: [userProfiles.authUserId],
  }),
  project: one(projects, {
    fields: [projectMilestones.projectId, projectMilestones.authUserId],
    references: [projects.id, projects.authUserId],
  }),
  checklistItems: many(milestoneChecklistItems),
  sourcedInvoices: many(invoices),
}));

export const milestoneChecklistItemsRelations = relations(milestoneChecklistItems, ({ one }) => ({
  userProfile: one(userProfiles, {
    fields: [milestoneChecklistItems.authUserId],
    references: [userProfiles.authUserId],
  }),
  milestone: one(projectMilestones, {
    fields: [milestoneChecklistItems.milestoneId, milestoneChecklistItems.authUserId],
    references: [projectMilestones.id, projectMilestones.authUserId],
  }),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  userProfile: one(userProfiles, {
    fields: [invoices.authUserId],
    references: [userProfiles.authUserId],
  }),
  client: one(clients, {
    fields: [invoices.clientId, invoices.authUserId],
    references: [clients.id, clients.authUserId],
  }),
  sourceProject: one(projects, {
    fields: [invoices.sourceProjectId, invoices.authUserId],
    references: [projects.id, projects.authUserId],
  }),
  sourceMilestone: one(projectMilestones, {
    fields: [invoices.sourceMilestoneId, invoices.authUserId],
    references: [projectMilestones.id, projectMilestones.authUserId],
  }),
  sessions: many(sessions),
  sessionLinks: many(invoiceSessionLinks),
}));

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  userProfile: one(userProfiles, {
    fields: [sessions.authUserId],
    references: [userProfiles.authUserId],
  }),
  client: one(clients, {
    fields: [sessions.clientId, sessions.authUserId],
    references: [clients.id, clients.authUserId],
  }),
  project: one(projects, {
    fields: [sessions.projectId, sessions.authUserId],
    references: [projects.id, projects.authUserId],
  }),
  task: one(tasks, {
    fields: [sessions.taskId, sessions.authUserId],
    references: [tasks.id, tasks.authUserId],
  }),
  invoice: one(invoices, {
    fields: [sessions.invoiceId, sessions.authUserId],
    references: [invoices.id, invoices.authUserId],
  }),
  breaks: many(sessionBreaks),
  invoiceLinks: many(invoiceSessionLinks),
}));

export const sessionBreaksRelations = relations(sessionBreaks, ({ one }) => ({
  userProfile: one(userProfiles, {
    fields: [sessionBreaks.authUserId],
    references: [userProfiles.authUserId],
  }),
  session: one(sessions, {
    fields: [sessionBreaks.sessionId, sessionBreaks.authUserId],
    references: [sessions.id, sessions.authUserId],
  }),
}));

export const invoiceSessionLinksRelations = relations(invoiceSessionLinks, ({ one }) => ({
  userProfile: one(userProfiles, {
    fields: [invoiceSessionLinks.authUserId],
    references: [userProfiles.authUserId],
  }),
  invoice: one(invoices, {
    fields: [invoiceSessionLinks.invoiceId, invoiceSessionLinks.authUserId],
    references: [invoices.id, invoices.authUserId],
  }),
  session: one(sessions, {
    fields: [invoiceSessionLinks.sessionId, invoiceSessionLinks.authUserId],
    references: [sessions.id, sessions.authUserId],
  }),
}));
