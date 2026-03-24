import * as hosted from '@/database/db.hosted';
import * as local from '@/database/db.local';
import type { DbProvider } from '@/database/provider';
import { isHostedMode } from '@/services/runtime-mode';

const localProvider: DbProvider = local;
const hostedProvider: DbProvider = hosted;

function provider(): DbProvider {
  return isHostedMode() ? hostedProvider : localProvider;
}

export type {
  PricingMode,
  MilestoneAmountType,
  MilestoneCompletionMode,
  InvoiceType,
  InvoiceSessionLinkMode,
  Session,
  Client,
  Project,
  Task,
  Invoice,
  InvoiceWithClient,
  UserProfile,
  SessionBreak,
  ProjectMilestone,
  MilestoneChecklistItem,
  InvoiceSessionLink,
  CoreDbValidationReport,
} from '@/database/types';

export function getDb(...args: Parameters<typeof local.getDb>): ReturnType<typeof local.getDb> {
  return provider().getDb(...args);
}

export function initializeDatabase(...args: Parameters<typeof local.initializeDatabase>): ReturnType<typeof local.initializeDatabase> {
  return provider().initializeDatabase(...args);
}

export function getCurrentSchemaVersion(...args: Parameters<typeof local.getCurrentSchemaVersion>): ReturnType<typeof local.getCurrentSchemaVersion> {
  return provider().getCurrentSchemaVersion(...args);
}

export function createClient(...args: Parameters<typeof local.createClient>): ReturnType<typeof local.createClient> {
  return provider().createClient(...args);
}

export function listClients(...args: Parameters<typeof local.listClients>): ReturnType<typeof local.listClients> {
  return provider().listClients(...args);
}

export function getClientById(...args: Parameters<typeof local.getClientById>): ReturnType<typeof local.getClientById> {
  return provider().getClientById(...args);
}

export function getUserProfile(...args: Parameters<typeof local.getUserProfile>): ReturnType<typeof local.getUserProfile> {
  return provider().getUserProfile(...args);
}

export function upsertUserProfile(...args: Parameters<typeof local.upsertUserProfile>): ReturnType<typeof local.upsertUserProfile> {
  return provider().upsertUserProfile(...args);
}

export function updateClientInvoiceContact(...args: Parameters<typeof local.updateClientInvoiceContact>): ReturnType<typeof local.updateClientInvoiceContact> {
  return provider().updateClientInvoiceContact(...args);
}

export function updateClientHourlyRate(...args: Parameters<typeof local.updateClientHourlyRate>): ReturnType<typeof local.updateClientHourlyRate> {
  return provider().updateClientHourlyRate(...args);
}

export function createProject(...args: Parameters<typeof local.createProject>): ReturnType<typeof local.createProject> {
  return provider().createProject(...args);
}

export function listProjectsByClient(...args: Parameters<typeof local.listProjectsByClient>): ReturnType<typeof local.listProjectsByClient> {
  return provider().listProjectsByClient(...args);
}

export function listProjects(...args: Parameters<typeof local.listProjects>): ReturnType<typeof local.listProjects> {
  return provider().listProjects(...args);
}

export function getProjectById(...args: Parameters<typeof local.getProjectById>): ReturnType<typeof local.getProjectById> {
  return provider().getProjectById(...args);
}

export function updateProjectPricing(...args: Parameters<typeof local.updateProjectPricing>): ReturnType<typeof local.updateProjectPricing> {
  return provider().updateProjectPricing(...args);
}

export function createTask(...args: Parameters<typeof local.createTask>): ReturnType<typeof local.createTask> {
  return provider().createTask(...args);
}

export function listTasksByProject(...args: Parameters<typeof local.listTasksByProject>): ReturnType<typeof local.listTasksByProject> {
  return provider().listTasksByProject(...args);
}

export function createProjectMilestone(...args: Parameters<typeof local.createProjectMilestone>): ReturnType<typeof local.createProjectMilestone> {
  return provider().createProjectMilestone(...args);
}

export function listProjectMilestones(...args: Parameters<typeof local.listProjectMilestones>): ReturnType<typeof local.listProjectMilestones> {
  return provider().listProjectMilestones(...args);
}

export function getProjectMilestoneById(...args: Parameters<typeof local.getProjectMilestoneById>): ReturnType<typeof local.getProjectMilestoneById> {
  return provider().getProjectMilestoneById(...args);
}

export function updateProjectMilestone(...args: Parameters<typeof local.updateProjectMilestone>): ReturnType<typeof local.updateProjectMilestone> {
  return provider().updateProjectMilestone(...args);
}

export function deleteProjectMilestone(...args: Parameters<typeof local.deleteProjectMilestone>): ReturnType<typeof local.deleteProjectMilestone> {
  return provider().deleteProjectMilestone(...args);
}

export function setProjectMilestoneCompletion(...args: Parameters<typeof local.setProjectMilestoneCompletion>): ReturnType<typeof local.setProjectMilestoneCompletion> {
  return provider().setProjectMilestoneCompletion(...args);
}

export function createMilestoneChecklistItem(...args: Parameters<typeof local.createMilestoneChecklistItem>): ReturnType<typeof local.createMilestoneChecklistItem> {
  return provider().createMilestoneChecklistItem(...args);
}

export function listMilestoneChecklistItems(...args: Parameters<typeof local.listMilestoneChecklistItems>): ReturnType<typeof local.listMilestoneChecklistItems> {
  return provider().listMilestoneChecklistItems(...args);
}

export function updateMilestoneChecklistItem(...args: Parameters<typeof local.updateMilestoneChecklistItem>): ReturnType<typeof local.updateMilestoneChecklistItem> {
  return provider().updateMilestoneChecklistItem(...args);
}

export function listMilestoneChecklistItemsByMilestoneIds(...args: Parameters<typeof local.listMilestoneChecklistItemsByMilestoneIds>): ReturnType<typeof local.listMilestoneChecklistItemsByMilestoneIds> {
  return provider().listMilestoneChecklistItemsByMilestoneIds(...args);
}

export function areMilestoneChecklistItemsComplete(...args: Parameters<typeof local.areMilestoneChecklistItemsComplete>): ReturnType<typeof local.areMilestoneChecklistItemsComplete> {
  return provider().areMilestoneChecklistItemsComplete(...args);
}

export function startSession(...args: Parameters<typeof local.startSession>): ReturnType<typeof local.startSession> {
  return provider().startSession(...args);
}

export function stopSession(...args: Parameters<typeof local.stopSession>): ReturnType<typeof local.stopSession> {
  return provider().stopSession(...args);
}

export function addManualSession(...args: Parameters<typeof local.addManualSession>): ReturnType<typeof local.addManualSession> {
  return provider().addManualSession(...args);
}

export function updateSession(...args: Parameters<typeof local.updateSession>): ReturnType<typeof local.updateSession> {
  return provider().updateSession(...args);
}

export function listSessions(...args: Parameters<typeof local.listSessions>): ReturnType<typeof local.listSessions> {
  return provider().listSessions(...args);
}

export function listSessionsByClientAndRange(...args: Parameters<typeof local.listSessionsByClientAndRange>): ReturnType<typeof local.listSessionsByClientAndRange> {
  return provider().listSessionsByClientAndRange(...args);
}

export function listSessionsByProject(...args: Parameters<typeof local.listSessionsByProject>): ReturnType<typeof local.listSessionsByProject> {
  return provider().listSessionsByProject(...args);
}

export function createInvoice(...args: Parameters<typeof local.createInvoice>): ReturnType<typeof local.createInvoice> {
  return provider().createInvoice(...args);
}

export function listInvoices(...args: Parameters<typeof local.listInvoices>): ReturnType<typeof local.listInvoices> {
  return provider().listInvoices(...args);
}

export function listSessionsByInvoiceId(...args: Parameters<typeof local.listSessionsByInvoiceId>): ReturnType<typeof local.listSessionsByInvoiceId> {
  return provider().listSessionsByInvoiceId(...args);
}

export function assignSessionsToInvoice(...args: Parameters<typeof local.assignSessionsToInvoice>): ReturnType<typeof local.assignSessionsToInvoice> {
  return provider().assignSessionsToInvoice(...args);
}

export function createInvoiceSessionLinks(...args: Parameters<typeof local.createInvoiceSessionLinks>): ReturnType<typeof local.createInvoiceSessionLinks> {
  return provider().createInvoiceSessionLinks(...args);
}

export function listInvoiceSessionLinksByInvoiceId(...args: Parameters<typeof local.listInvoiceSessionLinksByInvoiceId>): ReturnType<typeof local.listInvoiceSessionLinksByInvoiceId> {
  return provider().listInvoiceSessionLinksByInvoiceId(...args);
}

export function updateSessionNotes(...args: Parameters<typeof local.updateSessionNotes>): ReturnType<typeof local.updateSessionNotes> {
  return provider().updateSessionNotes(...args);
}

export function listSessionBreaksBySessionId(...args: Parameters<typeof local.listSessionBreaksBySessionId>): ReturnType<typeof local.listSessionBreaksBySessionId> {
  return provider().listSessionBreaksBySessionId(...args);
}

export function listSessionBreaksBySessionIds(...args: Parameters<typeof local.listSessionBreaksBySessionIds>): ReturnType<typeof local.listSessionBreaksBySessionIds> {
  return provider().listSessionBreaksBySessionIds(...args);
}

export function isSessionPaused(...args: Parameters<typeof local.isSessionPaused>): ReturnType<typeof local.isSessionPaused> {
  return provider().isSessionPaused(...args);
}

export function pauseSession(...args: Parameters<typeof local.pauseSession>): ReturnType<typeof local.pauseSession> {
  return provider().pauseSession(...args);
}

export function resumeSession(...args: Parameters<typeof local.resumeSession>): ReturnType<typeof local.resumeSession> {
  return provider().resumeSession(...args);
}

export function runCoreDbValidationScript(...args: Parameters<typeof local.runCoreDbValidationScript>): ReturnType<typeof local.runCoreDbValidationScript> {
  return provider().runCoreDbValidationScript(...args);
}

