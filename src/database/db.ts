import type { DbProvider } from '@/database/provider';
import { isHostedMode } from '@/services/runtime-mode';

type LocalDbModule = typeof import('@/database/db.local');
type HostedDbModule = typeof import('@/database/db.hosted');

let localProvider: DbProvider | null = null;
let hostedProvider: DbProvider | null = null;

function getLocalProvider(): DbProvider {
  if (!localProvider) {
    // Keep the local SQLite provider out of hosted bundles until it is actually needed.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    localProvider = require('@/database/db.local') as LocalDbModule;
  }

  return localProvider;
}

function getHostedProvider(): DbProvider {
  if (!hostedProvider) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    hostedProvider = require('@/database/db.hosted') as HostedDbModule;
  }

  return hostedProvider;
}

function provider(): DbProvider {
  return isHostedMode() ? getHostedProvider() : getLocalProvider();
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

export function getDb(...args: Parameters<LocalDbModule['getDb']>): ReturnType<LocalDbModule['getDb']> {
  return provider().getDb(...args);
}

export function initializeDatabase(...args: Parameters<LocalDbModule['initializeDatabase']>): ReturnType<LocalDbModule['initializeDatabase']> {
  return provider().initializeDatabase(...args);
}

export function getCurrentSchemaVersion(...args: Parameters<LocalDbModule['getCurrentSchemaVersion']>): ReturnType<LocalDbModule['getCurrentSchemaVersion']> {
  return provider().getCurrentSchemaVersion(...args);
}

export function createClient(...args: Parameters<LocalDbModule['createClient']>): ReturnType<LocalDbModule['createClient']> {
  return provider().createClient(...args);
}

export function listClients(...args: Parameters<LocalDbModule['listClients']>): ReturnType<LocalDbModule['listClients']> {
  return provider().listClients(...args);
}

export function getClientById(...args: Parameters<LocalDbModule['getClientById']>): ReturnType<LocalDbModule['getClientById']> {
  return provider().getClientById(...args);
}

export function getUserProfile(...args: Parameters<LocalDbModule['getUserProfile']>): ReturnType<LocalDbModule['getUserProfile']> {
  return provider().getUserProfile(...args);
}

export function upsertUserProfile(...args: Parameters<LocalDbModule['upsertUserProfile']>): ReturnType<LocalDbModule['upsertUserProfile']> {
  return provider().upsertUserProfile(...args);
}

export function updateClientInvoiceContact(...args: Parameters<LocalDbModule['updateClientInvoiceContact']>): ReturnType<LocalDbModule['updateClientInvoiceContact']> {
  return provider().updateClientInvoiceContact(...args);
}

export function updateClientHourlyRate(...args: Parameters<LocalDbModule['updateClientHourlyRate']>): ReturnType<LocalDbModule['updateClientHourlyRate']> {
  return provider().updateClientHourlyRate(...args);
}

export function createProject(...args: Parameters<LocalDbModule['createProject']>): ReturnType<LocalDbModule['createProject']> {
  return provider().createProject(...args);
}

export function listProjectsByClient(...args: Parameters<LocalDbModule['listProjectsByClient']>): ReturnType<LocalDbModule['listProjectsByClient']> {
  return provider().listProjectsByClient(...args);
}

export function listProjects(...args: Parameters<LocalDbModule['listProjects']>): ReturnType<LocalDbModule['listProjects']> {
  return provider().listProjects(...args);
}

export function getProjectById(...args: Parameters<LocalDbModule['getProjectById']>): ReturnType<LocalDbModule['getProjectById']> {
  return provider().getProjectById(...args);
}

export function updateProjectPricing(...args: Parameters<LocalDbModule['updateProjectPricing']>): ReturnType<LocalDbModule['updateProjectPricing']> {
  return provider().updateProjectPricing(...args);
}

export function createTask(...args: Parameters<LocalDbModule['createTask']>): ReturnType<LocalDbModule['createTask']> {
  return provider().createTask(...args);
}

export function listTasksByProject(...args: Parameters<LocalDbModule['listTasksByProject']>): ReturnType<LocalDbModule['listTasksByProject']> {
  return provider().listTasksByProject(...args);
}

export function createProjectMilestone(...args: Parameters<LocalDbModule['createProjectMilestone']>): ReturnType<LocalDbModule['createProjectMilestone']> {
  return provider().createProjectMilestone(...args);
}

export function listProjectMilestones(...args: Parameters<LocalDbModule['listProjectMilestones']>): ReturnType<LocalDbModule['listProjectMilestones']> {
  return provider().listProjectMilestones(...args);
}

export function getProjectMilestoneById(...args: Parameters<LocalDbModule['getProjectMilestoneById']>): ReturnType<LocalDbModule['getProjectMilestoneById']> {
  return provider().getProjectMilestoneById(...args);
}

export function updateProjectMilestone(...args: Parameters<LocalDbModule['updateProjectMilestone']>): ReturnType<LocalDbModule['updateProjectMilestone']> {
  return provider().updateProjectMilestone(...args);
}

export function deleteProjectMilestone(...args: Parameters<LocalDbModule['deleteProjectMilestone']>): ReturnType<LocalDbModule['deleteProjectMilestone']> {
  return provider().deleteProjectMilestone(...args);
}

export function setProjectMilestoneCompletion(...args: Parameters<LocalDbModule['setProjectMilestoneCompletion']>): ReturnType<LocalDbModule['setProjectMilestoneCompletion']> {
  return provider().setProjectMilestoneCompletion(...args);
}

export function createMilestoneChecklistItem(...args: Parameters<LocalDbModule['createMilestoneChecklistItem']>): ReturnType<LocalDbModule['createMilestoneChecklistItem']> {
  return provider().createMilestoneChecklistItem(...args);
}

export function listMilestoneChecklistItems(...args: Parameters<LocalDbModule['listMilestoneChecklistItems']>): ReturnType<LocalDbModule['listMilestoneChecklistItems']> {
  return provider().listMilestoneChecklistItems(...args);
}

export function updateMilestoneChecklistItem(...args: Parameters<LocalDbModule['updateMilestoneChecklistItem']>): ReturnType<LocalDbModule['updateMilestoneChecklistItem']> {
  return provider().updateMilestoneChecklistItem(...args);
}

export function listMilestoneChecklistItemsByMilestoneIds(...args: Parameters<LocalDbModule['listMilestoneChecklistItemsByMilestoneIds']>): ReturnType<LocalDbModule['listMilestoneChecklistItemsByMilestoneIds']> {
  return provider().listMilestoneChecklistItemsByMilestoneIds(...args);
}

export function areMilestoneChecklistItemsComplete(...args: Parameters<LocalDbModule['areMilestoneChecklistItemsComplete']>): ReturnType<LocalDbModule['areMilestoneChecklistItemsComplete']> {
  return provider().areMilestoneChecklistItemsComplete(...args);
}

export function startSession(...args: Parameters<LocalDbModule['startSession']>): ReturnType<LocalDbModule['startSession']> {
  return provider().startSession(...args);
}

export function stopSession(...args: Parameters<LocalDbModule['stopSession']>): ReturnType<LocalDbModule['stopSession']> {
  return provider().stopSession(...args);
}

export function addManualSession(...args: Parameters<LocalDbModule['addManualSession']>): ReturnType<LocalDbModule['addManualSession']> {
  return provider().addManualSession(...args);
}

export function updateSession(...args: Parameters<LocalDbModule['updateSession']>): ReturnType<LocalDbModule['updateSession']> {
  return provider().updateSession(...args);
}

export function listSessions(...args: Parameters<LocalDbModule['listSessions']>): ReturnType<LocalDbModule['listSessions']> {
  return provider().listSessions(...args);
}

export function listSessionsByClientAndRange(...args: Parameters<LocalDbModule['listSessionsByClientAndRange']>): ReturnType<LocalDbModule['listSessionsByClientAndRange']> {
  return provider().listSessionsByClientAndRange(...args);
}

export function listSessionsByProject(...args: Parameters<LocalDbModule['listSessionsByProject']>): ReturnType<LocalDbModule['listSessionsByProject']> {
  return provider().listSessionsByProject(...args);
}

export function createInvoice(...args: Parameters<LocalDbModule['createInvoice']>): ReturnType<LocalDbModule['createInvoice']> {
  return provider().createInvoice(...args);
}

export function listInvoices(...args: Parameters<LocalDbModule['listInvoices']>): ReturnType<LocalDbModule['listInvoices']> {
  return provider().listInvoices(...args);
}

export function listSessionsByInvoiceId(...args: Parameters<LocalDbModule['listSessionsByInvoiceId']>): ReturnType<LocalDbModule['listSessionsByInvoiceId']> {
  return provider().listSessionsByInvoiceId(...args);
}

export function assignSessionsToInvoice(...args: Parameters<LocalDbModule['assignSessionsToInvoice']>): ReturnType<LocalDbModule['assignSessionsToInvoice']> {
  return provider().assignSessionsToInvoice(...args);
}

export function createInvoiceSessionLinks(...args: Parameters<LocalDbModule['createInvoiceSessionLinks']>): ReturnType<LocalDbModule['createInvoiceSessionLinks']> {
  return provider().createInvoiceSessionLinks(...args);
}

export function listInvoiceSessionLinksByInvoiceId(...args: Parameters<LocalDbModule['listInvoiceSessionLinksByInvoiceId']>): ReturnType<LocalDbModule['listInvoiceSessionLinksByInvoiceId']> {
  return provider().listInvoiceSessionLinksByInvoiceId(...args);
}

export function updateSessionNotes(...args: Parameters<LocalDbModule['updateSessionNotes']>): ReturnType<LocalDbModule['updateSessionNotes']> {
  return provider().updateSessionNotes(...args);
}

export function listSessionBreaksBySessionId(...args: Parameters<LocalDbModule['listSessionBreaksBySessionId']>): ReturnType<LocalDbModule['listSessionBreaksBySessionId']> {
  return provider().listSessionBreaksBySessionId(...args);
}

export function listSessionBreaksBySessionIds(...args: Parameters<LocalDbModule['listSessionBreaksBySessionIds']>): ReturnType<LocalDbModule['listSessionBreaksBySessionIds']> {
  return provider().listSessionBreaksBySessionIds(...args);
}

export function isSessionPaused(...args: Parameters<LocalDbModule['isSessionPaused']>): ReturnType<LocalDbModule['isSessionPaused']> {
  return provider().isSessionPaused(...args);
}

export function pauseSession(...args: Parameters<LocalDbModule['pauseSession']>): ReturnType<LocalDbModule['pauseSession']> {
  return provider().pauseSession(...args);
}

export function resumeSession(...args: Parameters<LocalDbModule['resumeSession']>): ReturnType<LocalDbModule['resumeSession']> {
  return provider().resumeSession(...args);
}

export function runCoreDbValidationScript(...args: Parameters<LocalDbModule['runCoreDbValidationScript']>): ReturnType<LocalDbModule['runCoreDbValidationScript']> {
  return provider().runCoreDbValidationScript(...args);
}

