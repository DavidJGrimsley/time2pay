import { getSupabaseClient } from '@/services/supabase-client';
import {
  byId,
  callHostedWriteRoute,
  requireHostedUserId,
  withHostedRead,
} from '@/database/hosted/shared/runtime';
import { listClients, listProjects } from '@/database/hosted/clients-projects/queries';
import type { Client, Project, Session, SessionBreak, Task } from '@/database/hosted/types';

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

export async function hydrateSessions(
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

export function startSession(input: {
  id: string;
  client: string;
  client_id?: string | null;
  project_id?: string | null;
  task_id?: string | null;
  start_time?: string;
  notes?: string | null;
}): Promise<void> {
  return callHostedWriteRoute('/api/db/sessions/start', {
    id: input.id,
    client: input.client,
    clientId: input.client_id,
    projectId: input.project_id,
    taskId: input.task_id,
    startTime: input.start_time,
    notes: input.notes,
  });
}

export function stopSession(input: {
  id: string;
  end_time?: string;
}): Promise<void> {
  return callHostedWriteRoute('/api/db/sessions/stop', {
    id: input.id,
    endTime: input.end_time,
  });
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
  return callHostedWriteRoute('/api/db/sessions/add-manual', {
    id: input.id,
    client: input.client,
    clientId: input.client_id,
    projectId: input.project_id,
    taskId: input.task_id,
    startTime: input.start_time,
    endTime: input.end_time,
    notes: input.notes,
  });
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
  return callHostedWriteRoute('/api/db/sessions/update', {
    id: input.id,
    clientId: input.client_id,
    projectId: input.project_id,
    taskId: input.task_id,
    startTime: input.start_time,
    endTime: input.end_time,
    notes: input.notes,
  });
}

export function listSessions(): Promise<Session[]> {
  return withHostedRead(async () => {
    const supabase = getSupabaseClient();
    const userId = await requireHostedUserId();
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
  return withHostedRead(async () => {
    const supabase = getSupabaseClient();
    const userId = await requireHostedUserId();
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
  return withHostedRead(async () => {
    const supabase = getSupabaseClient();
    const userId = await requireHostedUserId();
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

export function updateSessionNotes(input: {
  id: string;
  notes: string | null;
  commit_sha?: string | null;
}): Promise<void> {
  return callHostedWriteRoute('/api/db/sessions/notes', {
    id: input.id,
    notes: input.notes,
    commitSha: input.commit_sha,
  });
}

export function listSessionBreaksBySessionId(sessionId: string): Promise<SessionBreak[]> {
  return withHostedRead(async () => {
    const supabase = getSupabaseClient();
    const userId = await requireHostedUserId();
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
  return withHostedRead(async () => {
    if (sessionIds.length === 0) {
      return [];
    }

    const supabase = getSupabaseClient();
    const userId = await requireHostedUserId();
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
  return withHostedRead(async () => {
    const supabase = getSupabaseClient();
    const userId = await requireHostedUserId();
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
  return callHostedWriteRoute('/api/db/sessions/pause', {
    sessionId: input.sessionId,
    startTime: input.start_time,
  });
}

export function resumeSession(input: {
  sessionId: string;
  end_time?: string;
}): Promise<void> {
  return callHostedWriteRoute('/api/db/sessions/resume', {
    sessionId: input.sessionId,
    endTime: input.end_time,
  });
}
