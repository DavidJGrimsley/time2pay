import type { DbProvider } from '@/database/provider';
import type {
  Client,
  Invoice,
  InvoiceSessionLink,
  InvoiceWithClient,
  MilestoneChecklistItem,
  Project,
  ProjectMilestone,
  Session,
  SessionBreak,
  Task,
  UserProfile,
} from '@/database/types';

const PROFILE_ID = 'me';
const TOUR_CLIENT_ID = 'tour_client_001';
const TOUR_PROJECT_ID = 'tour_project_001';
const TOUR_TASK_ONE_ID = 'tour_task_001';
const TOUR_TASK_TWO_ID = 'tour_task_002';
const TOUR_MILESTONE_ID = 'tour_milestone_001';
const TOUR_INVOICE_ID = 'tour_invoice_001';
const TOUR_SCHEMA_VERSION = 1;

type TourUserProfile = UserProfile & { github_pat: string | null };
type TourState = {
  profile: TourUserProfile;
  clients: Client[];
  projects: Project[];
  tasks: Task[];
  milestones: ProjectMilestone[];
  checklistItems: MilestoneChecklistItem[];
  sessions: Session[];
  sessionBreaks: SessionBreak[];
  invoices: Invoice[];
  invoiceSessionLinks: InvoiceSessionLink[];
};

let state: TourState | null = null;

function nowIso(): string {
  return new Date().toISOString();
}

function isoDaysAgo(daysAgo: number, hour: number, minute: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function parseIso(value: string, fieldName: string): number {
  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ${fieldName}: expected ISO-8601 timestamp`);
  }
  return parsed;
}

function nonNegative(value: number, fieldName: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${fieldName} must be a non-negative number.`);
  }
}

function durationSeconds(startIso: string, endIso: string): number {
  const startMs = parseIso(startIso, 'start_time');
  const endMs = parseIso(endIso, 'end_time');
  if (endMs < startMs) {
    throw new Error('Invalid session time range: end_time must be after start_time');
  }
  return Math.round((endMs - startMs) / 1000);
}

function createId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function byNameInsensitive<T extends { name: string }>(left: T, right: T): number {
  return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
}

function clone<T>(input: T): T {
  return JSON.parse(JSON.stringify(input)) as T;
}

function createInitialState(): TourState {
  const createdAt = nowIso();
  const s1Start = isoDaysAgo(6, 9, 0);
  const s1End = isoDaysAgo(6, 11, 0);
  const s2Start = isoDaysAgo(5, 13, 30);
  const s2End = isoDaysAgo(5, 15, 0);
  const s3Start = isoDaysAgo(2, 10, 15);
  const s3End = isoDaysAgo(2, 11, 30);
  const s4Start = isoDaysAgo(1, 14, 0);
  const s4End = isoDaysAgo(1, 14, 45);

  return {
    profile: {
      id: PROFILE_ID,
      company_name: 'Time2Pay Tour Studio',
      logo_url: '/images/time2payLogo.png',
      full_name: 'Tour User',
      phone: '(555) 010-2000',
      email: 'tour@time2pay.demo',
      github_pat: null,
      created_at: createdAt,
      updated_at: createdAt,
    },
    clients: [
      { id: TOUR_CLIENT_ID, name: 'Acme Design Co.', email: 'billing@acme-demo.test', phone: '(555) 010-1001', hourly_rate: 125, github_org: null, created_at: createdAt, updated_at: createdAt, deleted_at: null },
    ],
    projects: [
      { id: TOUR_PROJECT_ID, client_id: TOUR_CLIENT_ID, name: 'Website Refresh', github_repo: null, pricing_mode: 'milestone', total_project_fee: 2400, created_at: createdAt, updated_at: createdAt, deleted_at: null },
    ],
    tasks: [
      { id: TOUR_TASK_ONE_ID, project_id: TOUR_PROJECT_ID, name: 'Landing page polish', github_branch: null, created_at: createdAt, updated_at: createdAt, deleted_at: null },
      { id: TOUR_TASK_TWO_ID, project_id: TOUR_PROJECT_ID, name: 'Invoice workflow QA', github_branch: null, created_at: createdAt, updated_at: createdAt, deleted_at: null },
    ],
    milestones: [
      { id: TOUR_MILESTONE_ID, project_id: TOUR_PROJECT_ID, title: 'Launch milestone', amount_type: 'percent', amount_value: 50, completion_mode: 'checklist', due_note: 'Demo milestone for the tour workspace.', sort_order: 0, is_completed: 0, completed_at: null, created_at: createdAt, updated_at: createdAt, deleted_at: null },
    ],
    checklistItems: [
      { id: 'tour_checklist_001', milestone_id: TOUR_MILESTONE_ID, label: 'Approve updated landing page brief', sort_order: 0, is_completed: 1, completed_at: isoDaysAgo(3, 16, 0), created_at: createdAt, updated_at: createdAt, deleted_at: null },
      { id: 'tour_checklist_002', milestone_id: TOUR_MILESTONE_ID, label: 'Collect final stakeholder review notes', sort_order: 1, is_completed: 0, completed_at: null, created_at: createdAt, updated_at: createdAt, deleted_at: null },
    ],
    sessions: [
      { id: 'tour_session_001', client: 'Acme Design Co.', client_id: TOUR_CLIENT_ID, project_id: TOUR_PROJECT_ID, task_id: TOUR_TASK_ONE_ID, start_time: s1Start, end_time: s1End, duration: durationSeconds(s1Start, s1End), notes: 'Refined hero spacing, CTA layout, and mobile heading balance.', commit_sha: null, pr_url: null, pr_number: null, invoice_id: TOUR_INVOICE_ID, created_at: createdAt, updated_at: createdAt, deleted_at: null },
      { id: 'tour_session_002', client: 'Acme Design Co.', client_id: TOUR_CLIENT_ID, project_id: TOUR_PROJECT_ID, task_id: TOUR_TASK_TWO_ID, start_time: s2Start, end_time: s2End, duration: durationSeconds(s2Start, s2End), notes: 'Walked through invoice creation and polished the status messaging.', commit_sha: null, pr_url: null, pr_number: null, invoice_id: TOUR_INVOICE_ID, created_at: createdAt, updated_at: createdAt, deleted_at: null },
      { id: 'tour_session_003', client: 'Acme Design Co.', client_id: TOUR_CLIENT_ID, project_id: TOUR_PROJECT_ID, task_id: TOUR_TASK_ONE_ID, start_time: s3Start, end_time: s3End, duration: durationSeconds(s3Start, s3End), notes: 'Demo-ready responsive nav cleanup.', commit_sha: null, pr_url: null, pr_number: null, invoice_id: null, created_at: createdAt, updated_at: createdAt, deleted_at: null },
      { id: 'tour_session_004', client: 'Acme Design Co.', client_id: TOUR_CLIENT_ID, project_id: TOUR_PROJECT_ID, task_id: TOUR_TASK_TWO_ID, start_time: s4Start, end_time: s4End, duration: durationSeconds(s4Start, s4End), notes: 'Prepared demo copy for the profile and onboarding flow.', commit_sha: null, pr_url: null, pr_number: null, invoice_id: null, created_at: createdAt, updated_at: createdAt, deleted_at: null },
    ],
    sessionBreaks: [],
    invoices: [
      { id: TOUR_INVOICE_ID, client_id: TOUR_CLIENT_ID, total: 437.5, status: 'draft', invoice_type: 'hourly', mercury_invoice_id: null, payment_link: null, source_project_id: TOUR_PROJECT_ID, source_project_name: 'Website Refresh', source_milestone_id: null, source_milestone_title: null, source_milestone_amount_type: null, source_milestone_amount_value: null, source_milestone_completion_mode: null, source_milestone_completed_at: null, source_session_link_mode: 'billed', source_session_hourly_rate: 125, created_at: createdAt, updated_at: createdAt, deleted_at: null },
    ],
    invoiceSessionLinks: [
      { id: 'tour_invoice_link_001', invoice_id: TOUR_INVOICE_ID, session_id: 'tour_session_001', link_mode: 'billed', created_at: createdAt, updated_at: createdAt },
      { id: 'tour_invoice_link_002', invoice_id: TOUR_INVOICE_ID, session_id: 'tour_session_002', link_mode: 'billed', created_at: createdAt, updated_at: createdAt },
    ],
  };
}

function getState(): TourState {
  if (!state) {
    state = createInitialState();
  }
  return state;
}

export async function ensureTourProviderInitialized(): Promise<void> {
  getState();
}

export async function resetTourProviderData(): Promise<void> {
  state = createInitialState();
}

function sessionBreaksFor(sessionId: string): SessionBreak[] {
  return getState().sessionBreaks
    .filter((item) => item.session_id === sessionId && item.deleted_at === null)
    .sort((left, right) => (left.start_time < right.start_time ? -1 : 1));
}

function computeBreakDurationSeconds(input: {
  sessionStartIso: string;
  sessionEndIso: string;
  breaks: Pick<SessionBreak, 'start_time' | 'end_time'>[];
}): number {
  const sessionStartMs = parseIso(input.sessionStartIso, 'start_time');
  const sessionEndMs = parseIso(input.sessionEndIso, 'end_time');

  if (sessionEndMs <= sessionStartMs) {
    return 0;
  }

  const clampedIntervals = input.breaks
    .map((sessionBreak) => {
      if (!sessionBreak.end_time) {
        return null;
      }

      const breakStartMs = parseIso(sessionBreak.start_time, 'break.start_time');
      const breakEndMs = parseIso(sessionBreak.end_time, 'break.end_time');
      if (breakEndMs < breakStartMs) {
        throw new Error('Invalid break interval: end_time must be after start_time');
      }

      const clampedStart = Math.max(sessionStartMs, breakStartMs);
      const clampedEnd = Math.min(sessionEndMs, breakEndMs);
      if (clampedEnd <= clampedStart) {
        return null;
      }

      return [clampedStart, clampedEnd] as const;
    })
    .filter((interval): interval is readonly [number, number] => interval !== null)
    .sort((left, right) => left[0] - right[0]);

  if (clampedIntervals.length === 0) {
    return 0;
  }

  let mergedStart = clampedIntervals[0][0];
  let mergedEnd = clampedIntervals[0][1];
  let totalMs = 0;

  for (let index = 1; index < clampedIntervals.length; index += 1) {
    const [currentStart, currentEnd] = clampedIntervals[index];
    if (currentStart <= mergedEnd) {
      mergedEnd = Math.max(mergedEnd, currentEnd);
      continue;
    }

    totalMs += mergedEnd - mergedStart;
    mergedStart = currentStart;
    mergedEnd = currentEnd;
  }

  totalMs += mergedEnd - mergedStart;
  return Math.round(totalMs / 1000);
}

function decorateSession(session: Session): Session {
  const current = getState();
  const client = session.client_id ? current.clients.find((item) => item.id === session.client_id && item.deleted_at === null) ?? null : null;
  const project = session.project_id ? current.projects.find((item) => item.id === session.project_id && item.deleted_at === null) ?? null : null;
  const task = session.task_id ? current.tasks.find((item) => item.id === session.task_id && item.deleted_at === null) ?? null : null;
  const breaks = sessionBreaksFor(session.id);
  return {
    ...session,
    client_name: client?.name ?? null,
    project_name: project?.name ?? null,
    task_name: task?.name ?? null,
    github_org: client?.github_org ?? null,
    github_repo: project?.github_repo ?? null,
    github_branch: task?.github_branch ?? null,
    break_count: breaks.length,
    is_paused: breaks.some((item) => item.end_time === null) ? 1 : 0,
    commit_url: session.commit_sha && client?.github_org && project?.github_repo ? `https://github.com/${client.github_org}/${project.github_repo}/commit/${session.commit_sha}` : null,
    pr_url:
      session.pr_url ??
      (session.pr_number && client?.github_org && project?.github_repo
        ? `https://github.com/${client.github_org}/${project.github_repo}/pull/${session.pr_number}`
        : null),
    pr_number: session.pr_number ?? null,
  };
}

export const tourProvider: DbProvider = {
  async getDb() {
    throw new Error('Tour mode uses in-memory data and does not expose a SQLite handle.');
  },
  async initializeDatabase() {
    getState();
  },
  async getCurrentSchemaVersion() {
    return TOUR_SCHEMA_VERSION;
  },
  async getUserProfile() {
    return clone(getState().profile);
  },
  async upsertUserProfile(input) {
    const current = getState();
    current.profile = {
      ...current.profile,
      company_name: input.company_name === undefined ? current.profile.company_name : input.company_name ?? null,
      logo_url: input.logo_url === undefined ? current.profile.logo_url : input.logo_url ?? null,
      full_name: input.full_name === undefined ? current.profile.full_name : input.full_name ?? null,
      phone: input.phone === undefined ? current.profile.phone : input.phone ?? null,
      email: input.email === undefined ? current.profile.email : input.email ?? null,
      github_pat: input.github_pat === undefined ? current.profile.github_pat : input.github_pat ?? null,
      updated_at: nowIso(),
    };
  },
  async createClient(input) {
    const current = getState();
    nonNegative(input.hourly_rate ?? 0, 'Hourly rate');
    const timestamp = nowIso();
    current.clients.push({
      id: input.id,
      name: input.name,
      email: input.email ?? null,
      phone: input.phone ?? null,
      hourly_rate: input.hourly_rate ?? 0,
      github_org: input.github_org ?? null,
      created_at: timestamp,
      updated_at: timestamp,
      deleted_at: null,
    });
  },
  async listClients() {
    return getState().clients.filter((item) => item.deleted_at === null).map(clone).sort(byNameInsensitive);
  },
  async getClientById(clientId) {
    const client = getState().clients.find((item) => item.id === clientId && item.deleted_at === null) ?? null;
    return client ? clone(client) : null;
  },
  async updateClientInvoiceContact(input) {
    const current = getState();
    const index = current.clients.findIndex((item) => item.id === input.id && item.deleted_at === null);
    if (index < 0) {
      throw new Error('Client not found');
    }
    current.clients[index] = {
      ...current.clients[index],
      name: input.name,
      email: input.email ?? null,
      phone: input.phone ?? null,
      updated_at: nowIso(),
    };
  },
  async updateClientHourlyRate(input) {
    nonNegative(input.hourly_rate, 'Hourly rate');
    const current = getState();
    const index = current.clients.findIndex((item) => item.id === input.id && item.deleted_at === null);
    if (index < 0) {
      throw new Error('Client not found');
    }
    current.clients[index] = { ...current.clients[index], hourly_rate: input.hourly_rate, updated_at: nowIso() };
  },
  async createProject(input) {
    const current = getState();
    const pricingMode = input.pricing_mode ?? 'hourly';
    if (pricingMode !== 'hourly' && pricingMode !== 'milestone') {
      throw new Error('Invalid project pricing mode.');
    }
    if (input.total_project_fee !== undefined && input.total_project_fee !== null) {
      nonNegative(input.total_project_fee, 'Project fee');
    }
    const timestamp = nowIso();
    current.projects.push({
      id: input.id,
      client_id: input.client_id,
      name: input.name,
      github_repo: input.github_repo ?? null,
      pricing_mode: pricingMode,
      total_project_fee: input.total_project_fee ?? null,
      created_at: timestamp,
      updated_at: timestamp,
      deleted_at: null,
    });
  },
  async listProjectsByClient(clientId) {
    return getState().projects.filter((item) => item.client_id === clientId && item.deleted_at === null).map(clone).sort(byNameInsensitive);
  },
  async listProjects() {
    return getState().projects.filter((item) => item.deleted_at === null).map(clone).sort(byNameInsensitive);
  },
  async getProjectById(projectId) {
    const project = getState().projects.find((item) => item.id === projectId && item.deleted_at === null) ?? null;
    return project ? clone(project) : null;
  },
  async updateProjectPricing(input) {
    if (input.pricing_mode !== 'hourly' && input.pricing_mode !== 'milestone') {
      throw new Error('Invalid project pricing mode.');
    }
    if (input.total_project_fee !== null) {
      nonNegative(input.total_project_fee, 'Project fee');
    }
    const current = getState();
    const index = current.projects.findIndex((item) => item.id === input.id && item.deleted_at === null);
    if (index < 0) {
      throw new Error('Project not found');
    }
    current.projects[index] = { ...current.projects[index], pricing_mode: input.pricing_mode, total_project_fee: input.total_project_fee, updated_at: nowIso() };
  },
  async createTask(input) {
    const current = getState();
    const timestamp = nowIso();
    current.tasks.push({
      id: input.id,
      project_id: input.project_id,
      name: input.name,
      github_branch: input.github_branch ?? null,
      created_at: timestamp,
      updated_at: timestamp,
      deleted_at: null,
    });
  },
  async listTasksByProject(projectId) {
    return getState().tasks.filter((item) => item.project_id === projectId && item.deleted_at === null).map(clone).sort(byNameInsensitive);
  },
  async createProjectMilestone(input) {
    if (input.amount_type !== 'percent' && input.amount_type !== 'fixed') {
      throw new Error('Invalid milestone amount type.');
    }
    if (input.completion_mode !== 'toggle' && input.completion_mode !== 'checklist') {
      throw new Error('Invalid milestone completion mode.');
    }
    nonNegative(input.amount_value, 'Milestone amount');
    const current = getState();
    const timestamp = nowIso();
    current.milestones.push({
      id: input.id,
      project_id: input.project_id,
      title: input.title,
      amount_type: input.amount_type,
      amount_value: input.amount_value,
      completion_mode: input.completion_mode,
      due_note: input.due_note ?? null,
      sort_order: Number.isFinite(input.sort_order) ? Math.trunc(input.sort_order) : 0,
      is_completed: 0,
      completed_at: null,
      created_at: timestamp,
      updated_at: timestamp,
      deleted_at: null,
    });
  },
  async listProjectMilestones(projectId) {
    return getState().milestones
      .filter((item) => item.project_id === projectId && item.deleted_at === null)
      .map(clone)
      .sort((left, right) => left.sort_order - right.sort_order);
  },
  async getProjectMilestoneById(milestoneId) {
    const milestone = getState().milestones.find((item) => item.id === milestoneId && item.deleted_at === null) ?? null;
    return milestone ? clone(milestone) : null;
  },
  async updateProjectMilestone(input) {
    if (input.amount_type !== 'percent' && input.amount_type !== 'fixed') {
      throw new Error('Invalid milestone amount type.');
    }
    if (input.completion_mode !== 'toggle' && input.completion_mode !== 'checklist') {
      throw new Error('Invalid milestone completion mode.');
    }
    nonNegative(input.amount_value, 'Milestone amount');

    const current = getState();
    const index = current.milestones.findIndex((item) => item.id === input.id && item.deleted_at === null);
    if (index < 0) {
      throw new Error('Milestone not found');
    }
    const sortOrder = Number.isFinite(input.sort_order) ? Math.trunc(input.sort_order) : 0;
    current.milestones[index] = { ...current.milestones[index], title: input.title, amount_type: input.amount_type, amount_value: input.amount_value, completion_mode: input.completion_mode, due_note: input.due_note ?? null, sort_order: sortOrder, updated_at: nowIso() };
  },
  async deleteProjectMilestone(milestoneId) {
    const timestamp = nowIso();
    const current = getState();
    current.milestones = current.milestones.map((item) => item.id === milestoneId ? { ...item, deleted_at: timestamp, updated_at: timestamp } : item);
    current.checklistItems = current.checklistItems.map((item) => item.milestone_id === milestoneId ? { ...item, deleted_at: timestamp, updated_at: timestamp } : item);
  },
  async setProjectMilestoneCompletion(input) {
    const current = getState();
    const index = current.milestones.findIndex((item) => item.id === input.milestoneId && item.deleted_at === null);
    if (index < 0) {
      throw new Error('Milestone not found');
    }
    current.milestones[index] = { ...current.milestones[index], is_completed: input.isCompleted ? 1 : 0, completed_at: input.isCompleted ? input.completedAtIso ?? nowIso() : null, updated_at: nowIso() };
  },
  async createMilestoneChecklistItem(input) {
    const timestamp = nowIso();
    getState().checklistItems.push({
      id: input.id,
      milestone_id: input.milestone_id,
      label: input.label,
      sort_order: Number.isFinite(input.sort_order) ? Math.trunc(input.sort_order) : 0,
      is_completed: 0,
      completed_at: null,
      created_at: timestamp,
      updated_at: timestamp,
      deleted_at: null,
    });
  },
  async listMilestoneChecklistItems(milestoneId) {
    return getState().checklistItems.filter((item) => item.milestone_id === milestoneId && item.deleted_at === null).map(clone).sort((left, right) => left.sort_order - right.sort_order);
  },
  async updateMilestoneChecklistItem(input) {
    const current = getState();
    const index = current.checklistItems.findIndex((item) => item.id === input.id && item.deleted_at === null);
    if (index < 0) {
      throw new Error('Checklist item not found');
    }
    current.checklistItems[index] = { ...current.checklistItems[index], label: input.label, sort_order: Math.trunc(input.sort_order), is_completed: input.is_completed ? 1 : 0, completed_at: input.is_completed ? input.completed_at ?? nowIso() : null, updated_at: nowIso() };
  },
  async listMilestoneChecklistItemsByMilestoneIds(milestoneIds) {
    if (milestoneIds.length === 0) {
      return [];
    }
    return getState().checklistItems.filter((item) => milestoneIds.includes(item.milestone_id) && item.deleted_at === null).map(clone).sort((left, right) => left.sort_order - right.sort_order);
  },
  async areMilestoneChecklistItemsComplete(milestoneId) {
    const checklist = getState().checklistItems.filter((item) => item.milestone_id === milestoneId && item.deleted_at === null);
    return checklist.length > 0 && checklist.every((item) => item.is_completed === 1);
  },
  async startSession(input) {
    const timestamp = nowIso();
    const startTime = input.start_time ?? timestamp;
    parseIso(startTime, 'start_time');
    getState().sessions.push({
      id: input.id,
      client: input.client,
      client_id: input.client_id ?? null,
      project_id: input.project_id ?? null,
      task_id: input.task_id ?? null,
      start_time: startTime,
      end_time: null,
      duration: null,
      notes: input.notes ?? null,
      commit_sha: null,
      pr_url: null,
      pr_number: null,
      invoice_id: null,
      created_at: timestamp,
      updated_at: timestamp,
      deleted_at: null,
    });
  },
  async stopSession(input) {
    const current = getState();
    const index = current.sessions.findIndex((item) => item.id === input.id && item.deleted_at === null);
    if (index < 0) {
      throw new Error(`Session ${input.id} not found`);
    }
    const session = current.sessions[index];
    if (session.end_time) {
      throw new Error(`Session ${input.id} is already stopped`);
    }
    const endTime = input.end_time ?? nowIso();
    parseIso(endTime, 'end_time');
    const openBreak = current.sessionBreaks.find((item) => item.session_id === input.id && item.deleted_at === null && item.end_time === null);
    if (openBreak) {
      if (parseIso(endTime, 'end_time') < parseIso(openBreak.start_time, 'break.start_time')) {
        throw new Error('Session end_time cannot be before an active break start_time');
      }
      current.sessionBreaks = current.sessionBreaks.map((item) => item.id === openBreak.id ? { ...item, end_time: endTime, updated_at: nowIso() } : item);
    }
    const rawDuration = durationSeconds(session.start_time, endTime);
    const breakDuration = computeBreakDurationSeconds({
      sessionStartIso: session.start_time,
      sessionEndIso: endTime,
      breaks: sessionBreaksFor(input.id),
    });
    const duration = Math.max(0, rawDuration - breakDuration);
    current.sessions[index] = { ...session, end_time: endTime, duration, updated_at: nowIso() };
  },
  async addManualSession(input) {
    const timestamp = nowIso();
    getState().sessions.push({
      id: input.id,
      client: input.client,
      client_id: input.client_id ?? null,
      project_id: input.project_id ?? null,
      task_id: input.task_id ?? null,
      start_time: input.start_time,
      end_time: input.end_time,
      duration: durationSeconds(input.start_time, input.end_time),
      notes: input.notes ?? null,
      commit_sha: null,
      pr_url: null,
      pr_number: null,
      invoice_id: null,
      created_at: timestamp,
      updated_at: timestamp,
      deleted_at: null,
    });
  },
  async updateSession(input) {
    const current = getState();
    const index = current.sessions.findIndex((item) => item.id === input.id && item.deleted_at === null);
    if (index < 0) {
      throw new Error(`Session ${input.id} not found`);
    }
    const existing = current.sessions[index];
    if (existing.invoice_id !== null) {
      throw new Error('Invoiced sessions are locked and cannot be edited.');
    }
    const client = current.clients.find((item) => item.id === input.client_id && item.deleted_at === null);
    if (!client) {
      throw new Error('Invalid client selection.');
    }
    const project = current.projects.find((item) => item.id === input.project_id && item.client_id === input.client_id && item.deleted_at === null);
    if (!project) {
      throw new Error('Invalid project selection for the selected client.');
    }
    const task = current.tasks.find((item) => item.id === input.task_id && item.project_id === input.project_id && item.deleted_at === null);
    if (!task) {
      throw new Error('Invalid task selection for the selected project.');
    }
    const breaks = sessionBreaksFor(input.id);
    const rawDuration = durationSeconds(input.start_time, input.end_time);
    const breakDuration = computeBreakDurationSeconds({
      sessionStartIso: input.start_time,
      sessionEndIso: input.end_time,
      breaks,
    });
    const withBreakDuration = Math.max(0, rawDuration - breakDuration);
    current.sessions[index] = { ...existing, client: client.name, client_id: input.client_id, project_id: input.project_id, task_id: input.task_id, start_time: input.start_time, end_time: input.end_time, duration: withBreakDuration, notes: input.notes ?? null, updated_at: nowIso() };
  },
  async deleteSession(sessionId) {
    const current = getState();
    const index = current.sessions.findIndex((item) => item.id === sessionId && item.deleted_at === null);
    if (index < 0) {
      throw new Error('Session not found.');
    }
    const session = current.sessions[index];
    if (!session.end_time) {
      throw new Error('Only completed sessions can be deleted.');
    }
    if (session.invoice_id !== null) {
      throw new Error('Invoiced sessions cannot be deleted.');
    }
    if (current.invoiceSessionLinks.some((item) => item.session_id === sessionId)) {
      throw new Error('Sessions attached to invoice history cannot be deleted.');
    }

    const timestamp = nowIso();
    current.sessions[index] = { ...session, deleted_at: timestamp, updated_at: timestamp };
    current.sessionBreaks = current.sessionBreaks.map((item) =>
      item.session_id === sessionId && item.deleted_at === null
        ? { ...item, deleted_at: timestamp, updated_at: timestamp }
        : item,
    );
  },
  async listSessions() {
    return getState().sessions.filter((item) => item.deleted_at === null).map(decorateSession).sort((left, right) => (left.start_time < right.start_time ? 1 : -1));
  },
  async listSessionsByClientAndRange(input) {
    return getState().sessions
      .filter((item) => item.deleted_at === null && item.client_id === input.clientId && item.start_time >= input.rangeStartIso && item.start_time < input.rangeEndIso && (!input.uninvoicedOnly || item.invoice_id === null))
      .map(decorateSession)
      .sort((left, right) => (left.start_time < right.start_time ? -1 : 1));
  },
  async listSessionsByProject(input) {
    return getState().sessions
      .filter((item) => item.deleted_at === null && item.project_id === input.projectId && (!input.uninvoicedOnly || item.invoice_id === null))
      .map(decorateSession)
      .sort((left, right) => (left.start_time < right.start_time ? -1 : 1));
  },
  async updateSessionNotes(input) {
    const current = getState();
    const index = current.sessions.findIndex((item) => item.id === input.id && item.deleted_at === null);
    if (index >= 0) {
      current.sessions[index] = {
        ...current.sessions[index],
        notes: input.notes,
        commit_sha: input.commit_sha ?? null,
        pr_url: input.pr_url ?? null,
        pr_number: input.pr_number ?? null,
        updated_at: nowIso(),
      };
    }
  },
  async listSessionBreaksBySessionId(sessionId) {
    return sessionBreaksFor(sessionId).map(clone);
  },
  async listSessionBreaksBySessionIds(sessionIds) {
    if (sessionIds.length === 0) {
      return [];
    }
    return getState().sessionBreaks.filter((item) => sessionIds.includes(item.session_id) && item.deleted_at === null).map(clone).sort((left, right) => (left.start_time < right.start_time ? -1 : 1));
  },
  async isSessionPaused(sessionId) {
    return getState().sessionBreaks.some((item) => item.session_id === sessionId && item.deleted_at === null && item.end_time === null);
  },
  async pauseSession(input) {
    const current = getState();
    const session = current.sessions.find((item) => item.id === input.sessionId && item.deleted_at === null);
    if (!session) {
      throw new Error(`Session ${input.sessionId} not found`);
    }
    if (session.end_time) {
      throw new Error('Cannot pause a completed session');
    }
    if (current.sessionBreaks.some((item) => item.session_id === input.sessionId && item.deleted_at === null && item.end_time === null)) {
      throw new Error('Session is already paused');
    }
    const breakStart = input.start_time ?? nowIso();
    if (parseIso(breakStart, 'break_start_time') < parseIso(session.start_time, 'start_time')) {
      throw new Error('Cannot pause before the session start time');
    }
    const timestamp = nowIso();
    current.sessionBreaks.push({ id: createId('break'), session_id: input.sessionId, start_time: breakStart, end_time: null, created_at: timestamp, updated_at: timestamp, deleted_at: null });
  },
  async resumeSession(input) {
    const current = getState();
    const session = current.sessions.find((item) => item.id === input.sessionId && item.deleted_at === null);
    if (!session) {
      throw new Error(`Session ${input.sessionId} not found`);
    }
    if (session.end_time) {
      throw new Error('Cannot resume a completed session');
    }
    const openBreak = current.sessionBreaks.find((item) => item.session_id === input.sessionId && item.deleted_at === null && item.end_time === null);
    if (!openBreak) {
      throw new Error('Session is not paused');
    }
    const resumeTime = input.end_time ?? nowIso();
    if (parseIso(resumeTime, 'resume_time') < parseIso(openBreak.start_time, 'break.start_time')) {
      throw new Error('Cannot resume before break start time');
    }
    current.sessionBreaks = current.sessionBreaks.map((item) => item.id === openBreak.id ? { ...item, end_time: resumeTime, updated_at: nowIso() } : item);
  },
  async createInvoice(input) {
    nonNegative(input.total, 'Invoice total');
    const timestamp = nowIso();
    getState().invoices.push({
      id: input.id,
      client_id: input.client_id,
      total: input.total,
      status: input.status ?? 'draft',
      invoice_type: input.invoice_type ?? 'hourly',
      mercury_invoice_id: input.mercury_invoice_id ?? null,
      payment_link: input.payment_link ?? null,
      source_project_id: input.source_project_id ?? null,
      source_project_name: input.source_project_name ?? null,
      source_milestone_id: input.source_milestone_id ?? null,
      source_milestone_title: input.source_milestone_title ?? null,
      source_milestone_amount_type: input.source_milestone_amount_type ?? null,
      source_milestone_amount_value: input.source_milestone_amount_value ?? null,
      source_milestone_completion_mode: input.source_milestone_completion_mode ?? null,
      source_milestone_completed_at: input.source_milestone_completed_at ?? null,
      source_session_link_mode: input.source_session_link_mode ?? null,
      source_session_hourly_rate: input.source_session_hourly_rate ?? null,
      created_at: timestamp,
      updated_at: timestamp,
      deleted_at: null,
    });
  },
  async deleteInvoice(invoiceId) {
    const current = getState();
    const invoice = current.invoices.find((item) => item.id === invoiceId && item.deleted_at === null);
    if (!invoice) {
      throw new Error('Invoice not found');
    }
    if (invoice.mercury_invoice_id) {
      throw new Error('Mercury-backed invoices must be reviewed in Mercury and cannot be deleted locally.');
    }
    if (invoice.status !== 'draft') {
      throw new Error('Only draft invoices can be deleted.');
    }

    const timestamp = nowIso();
    current.invoices = current.invoices.map((item) =>
      item.id === invoiceId ? { ...item, deleted_at: timestamp, updated_at: timestamp } : item,
    );
    current.sessions = current.sessions.map((item) =>
      item.invoice_id === invoiceId ? { ...item, invoice_id: null, updated_at: timestamp } : item,
    );
    current.invoiceSessionLinks = current.invoiceSessionLinks.filter((item) => item.invoice_id !== invoiceId);
  },
  async listInvoices() {
    const current = getState();
    const rows: InvoiceWithClient[] = current.invoices.filter((item) => item.deleted_at === null).map((invoice) => {
      const client = current.clients.find((item) => item.id === invoice.client_id && item.deleted_at === null);
      return { ...clone(invoice), client_name: client?.name ?? null, client_email: client?.email ?? null, client_phone: client?.phone ?? null, client_hourly_rate: client?.hourly_rate ?? null };
    });
    return rows.sort((left, right) => (left.created_at < right.created_at ? 1 : -1));
  },
  async listSessionsByInvoiceId(invoiceId) {
    const current = getState();
    return current.sessions.filter((item) => item.deleted_at === null && (item.invoice_id === invoiceId || current.invoiceSessionLinks.some((link) => link.invoice_id === invoiceId && link.session_id === item.id))).map(decorateSession).sort((left, right) => (left.start_time < right.start_time ? -1 : 1));
  },
  async assignSessionsToInvoice(sessionIds, invoiceId) {
    if (sessionIds.length === 0) {
      return;
    }
    const timestamp = nowIso();
    const current = getState();
    current.sessions = current.sessions.map((item) => sessionIds.includes(item.id) ? { ...item, invoice_id: invoiceId, updated_at: timestamp } : item);
  },
  async createInvoiceSessionLinks(input) {
    if (input.sessionIds.length === 0) {
      return;
    }
    if (input.linkMode !== 'context' && input.linkMode !== 'billed') {
      throw new Error('Invalid invoice session link mode.');
    }
    const current = getState();
    const timestamp = nowIso();
    for (const sessionId of input.sessionIds) {
      const existing = current.invoiceSessionLinks.find((item) => item.invoice_id === input.invoiceId && item.session_id === sessionId);
      if (existing) {
        existing.link_mode = input.linkMode;
        existing.updated_at = timestamp;
      } else {
        current.invoiceSessionLinks.push({ id: createId('invoice_session_link'), invoice_id: input.invoiceId, session_id: sessionId, link_mode: input.linkMode, created_at: timestamp, updated_at: timestamp });
      }
    }
  },
  async listInvoiceSessionLinksByInvoiceId(invoiceId) {
    return getState().invoiceSessionLinks.filter((item) => item.invoice_id === invoiceId).map(clone).sort((left, right) => (left.created_at < right.created_at ? -1 : 1));
  },
  async runCoreDbValidationScript() {
    throw new Error('Core DB validation script is not available in tour mode.');
  },
};
