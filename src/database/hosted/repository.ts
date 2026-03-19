import type { SQLiteDatabase } from 'expo-sqlite';
import type {
  Client,
  CoreDbValidationReport,
  Invoice,
  InvoiceSessionLink,
  InvoiceSessionLinkMode,
  InvoiceType,
  InvoiceWithClient,
  MilestoneAmountType,
  MilestoneChecklistItem,
  MilestoneCompletionMode,
  PricingMode,
  Project,
  ProjectMilestone,
  Session,
  SessionBreak,
  Task,
  UserProfile,
} from '@/database/db.local';
import { getSupabaseClient, getSupabaseUser, requireSupabaseUserId } from '@/services/supabase-client';

function nowIso(): string {
  return new Date().toISOString();
}

type UserProfileRow = {
  auth_user_id: string;
  id: string;
  company_name: string | null;
  logo_url: string | null;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  github_pat: string | null;
  created_at: string;
  updated_at: string;
};

async function ensureHostedProfileRow(userId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const authUser = await getSupabaseUser();
  const metadata = (authUser?.user_metadata ?? {}) as Record<string, unknown>;
  const metadataName =
    typeof metadata.full_name === 'string'
      ? metadata.full_name
      : typeof metadata.name === 'string'
        ? metadata.name
        : typeof metadata.user_name === 'string'
          ? metadata.user_name
          : null;
  const timestamp = nowIso();

  const { error } = await supabase.from('user_profiles').upsert(
    {
      auth_user_id: userId,
      id: 'me',
      full_name: metadataName,
      email: authUser?.email ?? null,
      created_at: timestamp,
      updated_at: timestamp,
    },
    {
      onConflict: 'auth_user_id',
      ignoreDuplicates: true,
    },
  );

  if (error) {
    throw new Error(error.message);
  }
}

function toUserProfile(row: UserProfileRow): UserProfile {
  return {
    id: row.id,
    company_name: row.company_name,
    logo_url: row.logo_url,
    full_name: row.full_name,
    phone: row.phone,
    email: row.email,
    github_pat: row.github_pat,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function getDb(): Promise<SQLiteDatabase> {
  throw new Error('getDb is only available in local SQLite mode.');
}

export async function initializeDatabase(): Promise<void> {
  const userId = await requireSupabaseUserId();
  await ensureHostedProfileRow(userId);
}

export async function getCurrentSchemaVersion(): Promise<number> {
  return 1;
}

async function withHostedReadFallback<T>(read: () => Promise<T>): Promise<T> {
  return read();
}

type HostedWriteAction =
  | 'client.create'
  | 'client.updateContact'
  | 'client.updateHourlyRate'
  | 'project.create'
  | 'project.updatePricing'
  | 'task.create'
  | 'milestone.create'
  | 'milestone.update'
  | 'milestone.delete'
  | 'milestone.setCompletion'
  | 'milestoneChecklist.create'
  | 'milestoneChecklist.update'
  | 'session.start'
  | 'session.stop'
  | 'session.addManual'
  | 'session.update'
  | 'session.notes'
  | 'session.pause'
  | 'session.resume'
  | 'invoice.create'
  | 'invoice.assignSessions'
  | 'invoiceSessionLinks.upsert';

async function callHostedWriteRoute(
  action: HostedWriteAction,
  payload: Record<string, unknown>,
): Promise<void> {
  if (typeof window === 'undefined') {
    throw new Error('Hosted write route is only available in web runtime for now.');
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error(error.message);
  }

  const token = data.session?.access_token?.trim();
  if (!token) {
    throw new Error('Hosted write route requires an active Supabase session.');
  }

  const response = await fetch('/api/db/write', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action, payload }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? 'Hosted write route failed.');
  }
}

async function writeWithApiFallback(
  action: HostedWriteAction,
  payload: Record<string, unknown>,
): Promise<void> {
  await callHostedWriteRoute(action, payload);
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = toNumber(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function byId<T extends { id: string }>(rows: T[]): Map<string, T> {
  return new Map(rows.map((row) => [row.id, row]));
}

async function loadSessionReferenceMaps(userId: string): Promise<{
  clientsById: Map<string, Client>;
  projectsById: Map<string, Project>;
  tasksById: Map<string, Task>;
}> {
  const [clientsRows, projectRows, taskRows] = await Promise.all([
    listClients(),
    listProjects(),
    (async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('tasks')
        .select('id,project_id,name,github_branch,created_at,updated_at,deleted_at')
        .eq('auth_user_id', userId)
        .is('deleted_at', null);
      if (error) {
        throw new Error(error.message);
      }
      const rows = (data ?? []) as Array<Record<string, unknown>>;
      return rows.map((row) => ({
        id: String(row.id),
        project_id: String(row.project_id),
        name: String(row.name),
        github_branch: (row.github_branch as string | null) ?? null,
        created_at: String(row.created_at),
        updated_at: String(row.updated_at),
        deleted_at: (row.deleted_at as string | null) ?? null,
      })) as Task[];
    })(),
  ]);

  return {
    clientsById: byId(clientsRows),
    projectsById: byId(projectRows),
    tasksById: byId(taskRows),
  };
}

async function hydrateSessions(
  rows: Array<Record<string, unknown>>,
  userId: string,
): Promise<Session[]> {
  if (rows.length === 0) {
    return [];
  }

  const sessionIds = rows.map((row) => String(row.id));
  const [references, breaks] = await Promise.all([
    loadSessionReferenceMaps(userId),
    (async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('session_breaks')
        .select('session_id,end_time')
        .eq('auth_user_id', userId)
        .in('session_id', sessionIds)
        .is('deleted_at', null);

      if (error) {
        throw new Error(error.message);
      }
      return (data ?? []) as Array<Record<string, unknown>>;
    })(),
  ]);

  const breakCountBySessionId = new Map<string, number>();
  const pausedBySessionId = new Set<string>();
  for (const sessionBreak of breaks) {
    const sessionId = String(sessionBreak.session_id);
    breakCountBySessionId.set(sessionId, (breakCountBySessionId.get(sessionId) ?? 0) + 1);
    if (sessionBreak.end_time === null) {
      pausedBySessionId.add(sessionId);
    }
  }

  return rows.map((row) => {
    const clientId = (row.client_id as string | null) ?? null;
    const projectId = (row.project_id as string | null) ?? null;
    const taskId = (row.task_id as string | null) ?? null;
    const client = clientId ? references.clientsById.get(clientId) ?? null : null;
    const project = projectId ? references.projectsById.get(projectId) ?? null : null;
    const task = taskId ? references.tasksById.get(taskId) ?? null : null;
    const commitSha = (row.commit_sha as string | null) ?? null;
    const commitUrl =
      commitSha && client?.github_org && project?.github_repo
        ? `https://github.com/${client.github_org}/${project.github_repo}/commit/${commitSha}`
        : null;

    return {
      id: String(row.id),
      client: String(row.client),
      client_id: clientId,
      project_id: projectId,
      task_id: taskId,
      client_name: client?.name ?? null,
      project_name: project?.name ?? null,
      task_name: task?.name ?? null,
      github_org: client?.github_org ?? null,
      github_repo: project?.github_repo ?? null,
      github_branch: task?.github_branch ?? null,
      break_count: breakCountBySessionId.get(String(row.id)) ?? 0,
      is_paused: pausedBySessionId.has(String(row.id)) ? 1 : 0,
      start_time: String(row.start_time),
      end_time: (row.end_time as string | null) ?? null,
      duration: (row.duration as number | null) ?? null,
      notes: (row.notes as string | null) ?? null,
      commit_sha: commitSha,
      commit_url: commitUrl,
      invoice_id: (row.invoice_id as string | null) ?? null,
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
      deleted_at: (row.deleted_at as string | null) ?? null,
    };
  });
}

export function createClient(input: {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  hourly_rate?: number;
  github_org?: string | null;
}): Promise<void> {
  return writeWithApiFallback('client.create', input);
}

export function listClients(): Promise<Client[]> {
  return withHostedReadFallback(
    async () => {
      const supabase = getSupabaseClient();
      const userId = await requireSupabaseUserId();
      const { data, error } = await supabase
        .from('clients')
        .select('id,name,email,phone,hourly_rate,github_org,created_at,updated_at,deleted_at')
        .eq('auth_user_id', userId)
        .is('deleted_at', null)
        .order('name', { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      const rows = (data ?? []) as Array<Record<string, unknown>>;
      return rows.map((row) => ({
        id: String(row.id),
        name: String(row.name),
        email: (row.email as string | null) ?? null,
        phone: (row.phone as string | null) ?? null,
        hourly_rate: toNumber(row.hourly_rate),
        github_org: (row.github_org as string | null) ?? null,
        created_at: String(row.created_at),
        updated_at: String(row.updated_at),
        deleted_at: (row.deleted_at as string | null) ?? null,
      }));
    });
}

export function getClientById(clientId: string): Promise<Client | null> {
  return withHostedReadFallback(
    async () => {
      const supabase = getSupabaseClient();
      const userId = await requireSupabaseUserId();
      const { data, error } = await supabase
        .from('clients')
        .select('id,name,email,phone,hourly_rate,github_org,created_at,updated_at,deleted_at')
        .eq('auth_user_id', userId)
        .eq('id', clientId)
        .is('deleted_at', null)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }
      if (!data) {
        return null;
      }

      const row = data as Record<string, unknown>;
      return {
        id: String(row.id),
        name: String(row.name),
        email: (row.email as string | null) ?? null,
        phone: (row.phone as string | null) ?? null,
        hourly_rate: toNumber(row.hourly_rate),
        github_org: (row.github_org as string | null) ?? null,
        created_at: String(row.created_at),
        updated_at: String(row.updated_at),
        deleted_at: (row.deleted_at as string | null) ?? null,
      };
    });
}

export async function getUserProfile(): Promise<UserProfile> {
  const supabase = getSupabaseClient();
  const userId = await requireSupabaseUserId();
  await ensureHostedProfileRow(userId);

  const { data, error } = await supabase
    .from('user_profiles')
    .select('auth_user_id,id,company_name,logo_url,full_name,phone,email,github_pat,created_at,updated_at')
    .eq('auth_user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error('User profile could not be loaded');
  }

  return toUserProfile(data as UserProfileRow);
}

export async function upsertUserProfile(input: {
  company_name?: string | null;
  logo_url?: string | null;
  full_name?: string | null;
  phone?: string | null;
  email?: string | null;
  github_pat?: string | null;
}): Promise<void> {
  const supabase = getSupabaseClient();
  const userId = await requireSupabaseUserId();
  const existing = await getUserProfile();
  const timestamp = nowIso();

  const { error } = await supabase
    .from('user_profiles')
    .update({
      company_name: input.company_name === undefined ? existing.company_name : input.company_name,
      logo_url: input.logo_url === undefined ? existing.logo_url : input.logo_url,
      full_name: input.full_name === undefined ? existing.full_name : input.full_name,
      phone: input.phone === undefined ? existing.phone : input.phone,
      email: input.email === undefined ? existing.email : input.email,
      github_pat: input.github_pat === undefined ? existing.github_pat : input.github_pat,
      updated_at: timestamp,
    })
    .eq('auth_user_id', userId);

  if (error) {
    throw new Error(error.message);
  }
}

export function updateClientInvoiceContact(input: {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
}): Promise<void> {
  return writeWithApiFallback('client.updateContact', input);
}

export function createProject(input: {
  id: string;
  client_id: string;
  name: string;
  github_repo?: string | null;
  pricing_mode?: PricingMode;
  total_project_fee?: number | null;
}): Promise<void> {
  return writeWithApiFallback('project.create', input);
}

export function listProjectsByClient(clientId: string): Promise<Project[]> {
  return withHostedReadFallback(
    async () => {
      const supabase = getSupabaseClient();
      const userId = await requireSupabaseUserId();
      const { data, error } = await supabase
        .from('projects')
        .select(
          'id,client_id,name,github_repo,pricing_mode,total_project_fee,created_at,updated_at,deleted_at',
        )
        .eq('auth_user_id', userId)
        .eq('client_id', clientId)
        .is('deleted_at', null)
        .order('name', { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      const rows = (data ?? []) as Array<Record<string, unknown>>;
      return rows.map((row) => ({
        id: String(row.id),
        client_id: String(row.client_id),
        name: String(row.name),
        github_repo: (row.github_repo as string | null) ?? null,
        pricing_mode: (row.pricing_mode as PricingMode) ?? 'hourly',
        total_project_fee: toNumberOrNull(row.total_project_fee),
        created_at: String(row.created_at),
        updated_at: String(row.updated_at),
        deleted_at: (row.deleted_at as string | null) ?? null,
      }));
    });
}

export function listProjects(): Promise<Project[]> {
  return withHostedReadFallback(
    async () => {
      const supabase = getSupabaseClient();
      const userId = await requireSupabaseUserId();
      const { data, error } = await supabase
        .from('projects')
        .select(
          'id,client_id,name,github_repo,pricing_mode,total_project_fee,created_at,updated_at,deleted_at',
        )
        .eq('auth_user_id', userId)
        .is('deleted_at', null)
        .order('name', { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      const rows = (data ?? []) as Array<Record<string, unknown>>;
      return rows.map((row) => ({
        id: String(row.id),
        client_id: String(row.client_id),
        name: String(row.name),
        github_repo: (row.github_repo as string | null) ?? null,
        pricing_mode: (row.pricing_mode as PricingMode) ?? 'hourly',
        total_project_fee: toNumberOrNull(row.total_project_fee),
        created_at: String(row.created_at),
        updated_at: String(row.updated_at),
        deleted_at: (row.deleted_at as string | null) ?? null,
      }));
    });
}

export function getProjectById(projectId: string): Promise<Project | null> {
  return withHostedReadFallback(
    async () => {
      const supabase = getSupabaseClient();
      const userId = await requireSupabaseUserId();
      const { data, error } = await supabase
        .from('projects')
        .select(
          'id,client_id,name,github_repo,pricing_mode,total_project_fee,created_at,updated_at,deleted_at',
        )
        .eq('auth_user_id', userId)
        .eq('id', projectId)
        .is('deleted_at', null)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }
      if (!data) {
        return null;
      }

      const row = data as Record<string, unknown>;
      return {
        id: String(row.id),
        client_id: String(row.client_id),
        name: String(row.name),
        github_repo: (row.github_repo as string | null) ?? null,
        pricing_mode: (row.pricing_mode as PricingMode) ?? 'hourly',
        total_project_fee: toNumberOrNull(row.total_project_fee),
        created_at: String(row.created_at),
        updated_at: String(row.updated_at),
        deleted_at: (row.deleted_at as string | null) ?? null,
      };
    });
}

export function updateProjectPricing(input: {
  id: string;
  pricing_mode: PricingMode;
  total_project_fee: number | null;
}): Promise<void> {
  return writeWithApiFallback('project.updatePricing', input);
}

export function createTask(input: {
  id: string;
  project_id: string;
  name: string;
  github_branch?: string | null;
}): Promise<void> {
  return writeWithApiFallback('task.create', input);
}

export function listTasksByProject(projectId: string): Promise<Task[]> {
  return withHostedReadFallback(
    async () => {
      const supabase = getSupabaseClient();
      const userId = await requireSupabaseUserId();
      const { data, error } = await supabase
        .from('tasks')
        .select('id,project_id,name,github_branch,created_at,updated_at,deleted_at')
        .eq('auth_user_id', userId)
        .eq('project_id', projectId)
        .is('deleted_at', null)
        .order('name', { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      const rows = (data ?? []) as Array<Record<string, unknown>>;
      return rows.map((row) => ({
        id: String(row.id),
        project_id: String(row.project_id),
        name: String(row.name),
        github_branch: (row.github_branch as string | null) ?? null,
        created_at: String(row.created_at),
        updated_at: String(row.updated_at),
        deleted_at: (row.deleted_at as string | null) ?? null,
      }));
    });
}

export function updateClientHourlyRate(input: {
  id: string;
  hourly_rate: number;
}): Promise<void> {
  return writeWithApiFallback('client.updateHourlyRate', input);
}

export function createProjectMilestone(input: {
  id: string;
  project_id: string;
  title: string;
  amount_type: MilestoneAmountType;
  amount_value: number;
  completion_mode: MilestoneCompletionMode;
  due_note?: string | null;
  sort_order: number;
}): Promise<void> {
  return writeWithApiFallback('milestone.create', input);
}

export function listProjectMilestones(projectId: string): Promise<ProjectMilestone[]> {
  return withHostedReadFallback(
    async () => {
      const supabase = getSupabaseClient();
      const userId = await requireSupabaseUserId();
      const { data, error } = await supabase
        .from('project_milestones')
        .select(
          'id,project_id,title,amount_type,amount_value,completion_mode,due_note,sort_order,is_completed,completed_at,created_at,updated_at,deleted_at',
        )
        .eq('auth_user_id', userId)
        .eq('project_id', projectId)
        .is('deleted_at', null)
        .order('sort_order', { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      const rows = (data ?? []) as Array<Record<string, unknown>>;
      return rows.map((row) => ({
        id: String(row.id),
        project_id: String(row.project_id),
        title: String(row.title),
        amount_type: (row.amount_type as MilestoneAmountType) ?? 'fixed',
        amount_value: toNumber(row.amount_value),
        completion_mode: (row.completion_mode as MilestoneCompletionMode) ?? 'toggle',
        due_note: (row.due_note as string | null) ?? null,
        sort_order: Number(row.sort_order ?? 0),
        is_completed: row.is_completed ? 1 : 0,
        completed_at: (row.completed_at as string | null) ?? null,
        created_at: String(row.created_at),
        updated_at: String(row.updated_at),
        deleted_at: (row.deleted_at as string | null) ?? null,
      }));
    });
}

export function getProjectMilestoneById(milestoneId: string): Promise<ProjectMilestone | null> {
  return withHostedReadFallback(
    async () => {
      const supabase = getSupabaseClient();
      const userId = await requireSupabaseUserId();
      const { data, error } = await supabase
        .from('project_milestones')
        .select(
          'id,project_id,title,amount_type,amount_value,completion_mode,due_note,sort_order,is_completed,completed_at,created_at,updated_at,deleted_at',
        )
        .eq('auth_user_id', userId)
        .eq('id', milestoneId)
        .is('deleted_at', null)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }
      if (!data) {
        return null;
      }

      const row = data as Record<string, unknown>;
      return {
        id: String(row.id),
        project_id: String(row.project_id),
        title: String(row.title),
        amount_type: (row.amount_type as MilestoneAmountType) ?? 'fixed',
        amount_value: toNumber(row.amount_value),
        completion_mode: (row.completion_mode as MilestoneCompletionMode) ?? 'toggle',
        due_note: (row.due_note as string | null) ?? null,
        sort_order: Number(row.sort_order ?? 0),
        is_completed: row.is_completed ? 1 : 0,
        completed_at: (row.completed_at as string | null) ?? null,
        created_at: String(row.created_at),
        updated_at: String(row.updated_at),
        deleted_at: (row.deleted_at as string | null) ?? null,
      };
    });
}

export function updateProjectMilestone(input: {
  id: string;
  title: string;
  amount_type: MilestoneAmountType;
  amount_value: number;
  completion_mode: MilestoneCompletionMode;
  due_note?: string | null;
  sort_order: number;
}): Promise<void> {
  return writeWithApiFallback('milestone.update', input);
}

export function deleteProjectMilestone(milestoneId: string): Promise<void> {
  return writeWithApiFallback('milestone.delete', { milestone_id: milestoneId });
}

export function setProjectMilestoneCompletion(input: {
  milestoneId: string;
  isCompleted: boolean;
  completedAtIso?: string | null;
}): Promise<void> {
  return writeWithApiFallback(
    'milestone.setCompletion',
    {
      milestone_id: input.milestoneId,
      is_completed: input.isCompleted,
      completed_at: input.completedAtIso ?? null,
    });
}

export function createMilestoneChecklistItem(input: {
  id: string;
  milestone_id: string;
  label: string;
  sort_order: number;
}): Promise<void> {
  return writeWithApiFallback('milestoneChecklist.create', input);
}

export function listMilestoneChecklistItems(milestoneId: string): Promise<MilestoneChecklistItem[]> {
  return withHostedReadFallback(
    async () => {
      const supabase = getSupabaseClient();
      const userId = await requireSupabaseUserId();
      const { data, error } = await supabase
        .from('milestone_checklist_items')
        .select(
          'id,milestone_id,label,sort_order,is_completed,completed_at,created_at,updated_at,deleted_at',
        )
        .eq('auth_user_id', userId)
        .eq('milestone_id', milestoneId)
        .is('deleted_at', null)
        .order('sort_order', { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      const rows = (data ?? []) as Array<Record<string, unknown>>;
      return rows.map((row) => ({
        id: String(row.id),
        milestone_id: String(row.milestone_id),
        label: String(row.label),
        sort_order: Number(row.sort_order ?? 0),
        is_completed: row.is_completed ? 1 : 0,
        completed_at: (row.completed_at as string | null) ?? null,
        created_at: String(row.created_at),
        updated_at: String(row.updated_at),
        deleted_at: (row.deleted_at as string | null) ?? null,
      }));
    });
}

export function updateMilestoneChecklistItem(input: {
  id: string;
  label: string;
  sort_order: number;
  is_completed: boolean;
  completed_at?: string | null;
}): Promise<void> {
  return writeWithApiFallback('milestoneChecklist.update', input);
}

export function listMilestoneChecklistItemsByMilestoneIds(
  milestoneIds: string[],
): Promise<MilestoneChecklistItem[]> {
  return withHostedReadFallback(
    async () => {
      if (milestoneIds.length === 0) {
        return [];
      }

      const supabase = getSupabaseClient();
      const userId = await requireSupabaseUserId();
      const { data, error } = await supabase
        .from('milestone_checklist_items')
        .select(
          'id,milestone_id,label,sort_order,is_completed,completed_at,created_at,updated_at,deleted_at',
        )
        .eq('auth_user_id', userId)
        .in('milestone_id', milestoneIds)
        .is('deleted_at', null)
        .order('milestone_id', { ascending: true })
        .order('sort_order', { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      const rows = (data ?? []) as Array<Record<string, unknown>>;
      return rows.map((row) => ({
        id: String(row.id),
        milestone_id: String(row.milestone_id),
        label: String(row.label),
        sort_order: Number(row.sort_order ?? 0),
        is_completed: row.is_completed ? 1 : 0,
        completed_at: (row.completed_at as string | null) ?? null,
        created_at: String(row.created_at),
        updated_at: String(row.updated_at),
        deleted_at: (row.deleted_at as string | null) ?? null,
      }));
    });
}

export function areMilestoneChecklistItemsComplete(milestoneId: string): Promise<boolean> {
  return withHostedReadFallback(
    async () => {
      const items = await listMilestoneChecklistItems(milestoneId);
      return items.length > 0 && items.every((item) => item.is_completed === 1);
    });
}

export function startSession(input: {
  id: string;
  client: string;
  client_id?: string | null;
  project_id?: string | null;
  task_id?: string | null;
  start_time?: string;
  notes?: string | null;
}): Promise<void> {
  return writeWithApiFallback('session.start', input);
}

export function stopSession(input: {
  id: string;
  end_time?: string;
}): Promise<void> {
  return writeWithApiFallback('session.stop', input);
}

export function addManualSession(input: {
  id: string;
  client: string;
  client_id?: string | null;
  project_id?: string | null;
  task_id?: string | null;
  start_time: string;
  end_time: string;
  notes?: string | null;
}): Promise<void> {
  return writeWithApiFallback('session.addManual', input);
}

export function updateSession(input: {
  id: string;
  client_id: string;
  project_id: string;
  task_id: string;
  start_time: string;
  end_time: string;
  notes?: string | null;
}): Promise<void> {
  return writeWithApiFallback('session.update', input);
}

export function listSessions(): Promise<Session[]> {
  return withHostedReadFallback(
    async () => {
      const supabase = getSupabaseClient();
      const userId = await requireSupabaseUserId();
      const { data, error } = await supabase
        .from('sessions')
        .select(
          'id,client,client_id,project_id,task_id,start_time,end_time,duration,notes,commit_sha,invoice_id,created_at,updated_at,deleted_at',
        )
        .eq('auth_user_id', userId)
        .is('deleted_at', null)
        .order('start_time', { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      return hydrateSessions((data ?? []) as Array<Record<string, unknown>>, userId);
    });
}

export function listSessionsByClientAndRange(input: {
  clientId: string;
  rangeStartIso: string;
  rangeEndIso: string;
  uninvoicedOnly?: boolean;
}): Promise<Session[]> {
  return withHostedReadFallback(
    async () => {
      const supabase = getSupabaseClient();
      const userId = await requireSupabaseUserId();
      let query = supabase
        .from('sessions')
        .select(
          'id,client,client_id,project_id,task_id,start_time,end_time,duration,notes,commit_sha,invoice_id,created_at,updated_at,deleted_at',
        )
        .eq('auth_user_id', userId)
        .eq('client_id', input.clientId)
        .gte('start_time', input.rangeStartIso)
        .lt('start_time', input.rangeEndIso)
        .is('deleted_at', null)
        .order('start_time', { ascending: true });

      if (input.uninvoicedOnly) {
        query = query.is('invoice_id', null);
      }

      const { data, error } = await query;
      if (error) {
        throw new Error(error.message);
      }

      return hydrateSessions((data ?? []) as Array<Record<string, unknown>>, userId);
    });
}

export function listSessionsByProject(input: {
  projectId: string;
  uninvoicedOnly?: boolean;
}): Promise<Session[]> {
  return withHostedReadFallback(
    async () => {
      const supabase = getSupabaseClient();
      const userId = await requireSupabaseUserId();
      let query = supabase
        .from('sessions')
        .select(
          'id,client,client_id,project_id,task_id,start_time,end_time,duration,notes,commit_sha,invoice_id,created_at,updated_at,deleted_at',
        )
        .eq('auth_user_id', userId)
        .eq('project_id', input.projectId)
        .is('deleted_at', null)
        .order('start_time', { ascending: true });

      if (input.uninvoicedOnly) {
        query = query.is('invoice_id', null);
      }

      const { data, error } = await query;
      if (error) {
        throw new Error(error.message);
      }

      return hydrateSessions((data ?? []) as Array<Record<string, unknown>>, userId);
    });
}

export function createInvoice(input: {
  id: string;
  client_id: string;
  total: number;
  status?: Invoice['status'];
  invoice_type?: InvoiceType;
  mercury_invoice_id?: string | null;
  payment_link?: string | null;
  source_project_id?: string | null;
  source_project_name?: string | null;
  source_milestone_id?: string | null;
  source_milestone_title?: string | null;
  source_milestone_amount_type?: MilestoneAmountType | null;
  source_milestone_amount_value?: number | null;
  source_milestone_completion_mode?: MilestoneCompletionMode | null;
  source_milestone_completed_at?: string | null;
  source_session_link_mode?: InvoiceSessionLinkMode | null;
  source_session_hourly_rate?: number | null;
}): Promise<void> {
  return writeWithApiFallback('invoice.create', input);
}

export function listInvoices(): Promise<InvoiceWithClient[]> {
  return withHostedReadFallback(
    async () => {
      const supabase = getSupabaseClient();
      const userId = await requireSupabaseUserId();
      const [clientsData, invoicesResult] = await Promise.all([
        listClients(),
        supabase
          .from('invoices')
          .select(
            `id,client_id,total,status,invoice_type,mercury_invoice_id,payment_link,source_project_id,
             source_project_name,source_milestone_id,source_milestone_title,source_milestone_amount_type,
             source_milestone_amount_value,source_milestone_completion_mode,source_milestone_completed_at,
             source_session_link_mode,source_session_hourly_rate,created_at,updated_at,deleted_at`,
          )
          .eq('auth_user_id', userId)
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
      ]);

      if (invoicesResult.error) {
        throw new Error(invoicesResult.error.message);
      }

      const clientsById = byId(clientsData);
      const rows = (invoicesResult.data ?? []) as Array<Record<string, unknown>>;
      return rows.map((row) => {
        const client = clientsById.get(String(row.client_id));
        return {
          id: String(row.id),
          client_id: String(row.client_id),
          total: toNumber(row.total),
          status: (row.status as Invoice['status']) ?? 'draft',
          invoice_type: (row.invoice_type as InvoiceType) ?? 'hourly',
          mercury_invoice_id: (row.mercury_invoice_id as string | null) ?? null,
          payment_link: (row.payment_link as string | null) ?? null,
          source_project_id: (row.source_project_id as string | null) ?? null,
          source_project_name: (row.source_project_name as string | null) ?? null,
          source_milestone_id: (row.source_milestone_id as string | null) ?? null,
          source_milestone_title: (row.source_milestone_title as string | null) ?? null,
          source_milestone_amount_type:
            (row.source_milestone_amount_type as MilestoneAmountType | null) ?? null,
          source_milestone_amount_value: toNumberOrNull(row.source_milestone_amount_value),
          source_milestone_completion_mode:
            (row.source_milestone_completion_mode as MilestoneCompletionMode | null) ?? null,
          source_milestone_completed_at: (row.source_milestone_completed_at as string | null) ?? null,
          source_session_link_mode:
            (row.source_session_link_mode as InvoiceSessionLinkMode | null) ?? null,
          source_session_hourly_rate: toNumberOrNull(row.source_session_hourly_rate),
          created_at: String(row.created_at),
          updated_at: String(row.updated_at),
          deleted_at: (row.deleted_at as string | null) ?? null,
          client_name: client?.name ?? null,
          client_email: client?.email ?? null,
          client_phone: client?.phone ?? null,
          client_hourly_rate: client?.hourly_rate ?? null,
        };
      });
    });
}

export function listSessionsByInvoiceId(invoiceId: string): Promise<Session[]> {
  return withHostedReadFallback(
    async () => {
      const supabase = getSupabaseClient();
      const userId = await requireSupabaseUserId();
      const [directResult, links] = await Promise.all([
        supabase
          .from('sessions')
          .select(
            'id,client,client_id,project_id,task_id,start_time,end_time,duration,notes,commit_sha,invoice_id,created_at,updated_at,deleted_at',
          )
          .eq('auth_user_id', userId)
          .eq('invoice_id', invoiceId)
          .is('deleted_at', null),
        listInvoiceSessionLinksByInvoiceId(invoiceId),
      ]);

      if (directResult.error) {
        throw new Error(directResult.error.message);
      }

      const linkedSessionIds = links.map((link) => link.session_id);
      let linkedRows: Array<Record<string, unknown>> = [];
      if (linkedSessionIds.length > 0) {
        const linkedResult = await supabase
          .from('sessions')
          .select(
            'id,client,client_id,project_id,task_id,start_time,end_time,duration,notes,commit_sha,invoice_id,created_at,updated_at,deleted_at',
          )
          .eq('auth_user_id', userId)
          .in('id', linkedSessionIds)
          .is('deleted_at', null);

        if (linkedResult.error) {
          throw new Error(linkedResult.error.message);
        }
        linkedRows = (linkedResult.data ?? []) as Array<Record<string, unknown>>;
      }

      const allRows = [
        ...((directResult.data ?? []) as Array<Record<string, unknown>>),
        ...linkedRows,
      ];
      const deduped = new Map(allRows.map((row) => [String(row.id), row]));
      const hydrated = await hydrateSessions([...deduped.values()], userId);
      return hydrated.sort((a, b) => a.start_time.localeCompare(b.start_time));
    });
}

export function assignSessionsToInvoice(sessionIds: string[], invoiceId: string): Promise<void> {
  return writeWithApiFallback(
    'invoice.assignSessions',
    { session_ids: sessionIds, invoice_id: invoiceId });
}

export function createInvoiceSessionLinks(input: {
  invoiceId: string;
  sessionIds: string[];
  linkMode: InvoiceSessionLinkMode;
}): Promise<void> {
  return writeWithApiFallback(
    'invoiceSessionLinks.upsert',
    {
      invoice_id: input.invoiceId,
      session_ids: input.sessionIds,
      link_mode: input.linkMode,
    });
}

export function listInvoiceSessionLinksByInvoiceId(
  invoiceId: string,
): Promise<InvoiceSessionLink[]> {
  return withHostedReadFallback(
    async () => {
      const supabase = getSupabaseClient();
      const userId = await requireSupabaseUserId();
      const { data, error } = await supabase
        .from('invoice_session_links')
        .select('id,invoice_id,session_id,link_mode,created_at,updated_at')
        .eq('auth_user_id', userId)
        .eq('invoice_id', invoiceId)
        .order('created_at', { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      const rows = (data ?? []) as Array<Record<string, unknown>>;
      return rows.map((row) => ({
        id: String(row.id),
        invoice_id: String(row.invoice_id),
        session_id: String(row.session_id),
        link_mode: (row.link_mode as InvoiceSessionLinkMode) ?? 'context',
        created_at: String(row.created_at),
        updated_at: String(row.updated_at),
      }));
    });
}

export function updateSessionNotes(input: {
  id: string;
  notes: string | null;
  commit_sha?: string | null;
}): Promise<void> {
  return writeWithApiFallback('session.notes', input);
}

export function listSessionBreaksBySessionId(sessionId: string): Promise<SessionBreak[]> {
  return withHostedReadFallback(
    async () => {
      const supabase = getSupabaseClient();
      const userId = await requireSupabaseUserId();
      const { data, error } = await supabase
        .from('session_breaks')
        .select('id,session_id,start_time,end_time,created_at,updated_at,deleted_at')
        .eq('auth_user_id', userId)
        .eq('session_id', sessionId)
        .is('deleted_at', null)
        .order('start_time', { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      const rows = (data ?? []) as Array<Record<string, unknown>>;
      return rows.map((row) => ({
        id: String(row.id),
        session_id: String(row.session_id),
        start_time: String(row.start_time),
        end_time: (row.end_time as string | null) ?? null,
        created_at: String(row.created_at),
        updated_at: String(row.updated_at),
        deleted_at: (row.deleted_at as string | null) ?? null,
      }));
    });
}

export function listSessionBreaksBySessionIds(sessionIds: string[]): Promise<SessionBreak[]> {
  return withHostedReadFallback(
    async () => {
      if (sessionIds.length === 0) {
        return [];
      }

      const supabase = getSupabaseClient();
      const userId = await requireSupabaseUserId();
      const { data, error } = await supabase
        .from('session_breaks')
        .select('id,session_id,start_time,end_time,created_at,updated_at,deleted_at')
        .eq('auth_user_id', userId)
        .in('session_id', sessionIds)
        .is('deleted_at', null)
        .order('start_time', { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      const rows = (data ?? []) as Array<Record<string, unknown>>;
      return rows.map((row) => ({
        id: String(row.id),
        session_id: String(row.session_id),
        start_time: String(row.start_time),
        end_time: (row.end_time as string | null) ?? null,
        created_at: String(row.created_at),
        updated_at: String(row.updated_at),
        deleted_at: (row.deleted_at as string | null) ?? null,
      }));
    });
}

export function isSessionPaused(sessionId: string): Promise<boolean> {
  return withHostedReadFallback(
    async () => {
      const supabase = getSupabaseClient();
      const userId = await requireSupabaseUserId();
      const { data, error } = await supabase
        .from('session_breaks')
        .select('id')
        .eq('auth_user_id', userId)
        .eq('session_id', sessionId)
        .is('deleted_at', null)
        .is('end_time', null)
        .limit(1);

      if (error) {
        throw new Error(error.message);
      }

      return (data ?? []).length > 0;
    });
}

export function pauseSession(input: {
  sessionId: string;
  start_time?: string;
}): Promise<void> {
  return writeWithApiFallback(
    'session.pause',
    { session_id: input.sessionId, start_time: input.start_time });
}

export function resumeSession(input: {
  sessionId: string;
  end_time?: string;
}): Promise<void> {
  return writeWithApiFallback(
    'session.resume',
    { session_id: input.sessionId, end_time: input.end_time });
}

export async function runCoreDbValidationScript(): Promise<CoreDbValidationReport> {
  throw new Error('Core DB validation script is only available in local SQLite mode.');
}

export type {
  Client,
  CoreDbValidationReport,
  Invoice,
  InvoiceSessionLink,
  InvoiceSessionLinkMode,
  InvoiceType,
  InvoiceWithClient,
  MilestoneAmountType,
  MilestoneChecklistItem,
  MilestoneCompletionMode,
  PricingMode,
  Project,
  ProjectMilestone,
  Session,
  SessionBreak,
  Task,
  UserProfile,
};



