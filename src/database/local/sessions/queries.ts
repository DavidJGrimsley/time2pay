import type { Client, Project, Session, SessionBreak, Task } from '@/database/types';
import {
  computeBreakDurationMs,
  createDbId,
  dbDurationMsToSeconds,
  ensureNonNegativeDbDurationMs,
  getDb,
  nowIso,
  parseDbIsoTimestamp,
} from '@/database/local/shared/runtime';

export async function startSession(input: {
  id: string;
  client: string;
  client_id?: string | null;
  project_id?: string | null;
  task_id?: string | null;
  start_time?: string;
  notes?: string | null;
}): Promise<void> {
  const db = await getDb();
  const timestamp = nowIso();
  const startedAt = input.start_time ?? timestamp;
  parseDbIsoTimestamp(startedAt, 'start_time');

  await db.runAsync(
    `INSERT INTO sessions (
      id,
      client,
      client_id,
      project_id,
      task_id,
      start_time,
      end_time,
      duration,
      notes,
      invoice_id,
      created_at,
      updated_at,
      deleted_at
    )
     VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, NULL, ?, ?, NULL)`,
    input.id,
    input.client,
    input.client_id ?? null,
    input.project_id ?? null,
    input.task_id ?? null,
    startedAt,
    input.notes ?? null,
    timestamp,
    timestamp,
  );
}

export async function stopSession(input: {
  id: string;
  end_time?: string;
}): Promise<void> {
  const db = await getDb();
  const endedAt = input.end_time ?? nowIso();
  parseDbIsoTimestamp(endedAt, 'end_time');

  const row = await db.getFirstAsync<Pick<Session, 'start_time' | 'end_time' | 'deleted_at'>>(
    'SELECT start_time, end_time, deleted_at FROM sessions WHERE id = ?',
    input.id,
  );

  if (!row || row.deleted_at !== null) {
    throw new Error(`Session ${input.id} not found`);
  }

  if (row.end_time) {
    throw new Error(`Session ${input.id} is already stopped`);
  }

  const timestamp = nowIso();
  const openBreak = await db.getFirstAsync<Pick<SessionBreak, 'id' | 'start_time'>>(
    `SELECT id, start_time
     FROM session_breaks
     WHERE session_id = ? AND deleted_at IS NULL AND end_time IS NULL
     ORDER BY start_time DESC
     LIMIT 1`,
    input.id,
  );

  if (openBreak) {
    const openBreakStart = parseDbIsoTimestamp(openBreak.start_time, 'break.start_time').getTime();
    const clockOutAt = parseDbIsoTimestamp(endedAt, 'end_time').getTime();
    if (clockOutAt < openBreakStart) {
      throw new Error('Invalid end_time: cannot clock out before active break start');
    }

    await db.runAsync(
      `UPDATE session_breaks
         SET end_time = ?, updated_at = ?
       WHERE id = ? AND end_time IS NULL`,
      endedAt,
      timestamp,
      openBreak.id,
    );
  }

  const breakRows = await db.getAllAsync<Pick<SessionBreak, 'start_time' | 'end_time'>>(
    `SELECT start_time, end_time
     FROM session_breaks
     WHERE session_id = ?
       AND deleted_at IS NULL`,
    input.id,
  );

  const sessionDurationMs = ensureNonNegativeDbDurationMs(row.start_time, endedAt);
  const breakDurationMs = computeBreakDurationMs({
    sessionStartIso: row.start_time,
    sessionEndIso: endedAt,
    breaks: breakRows,
  });
  const billedDurationMs = Math.max(0, sessionDurationMs - breakDurationMs);
  const durationSeconds = dbDurationMsToSeconds(billedDurationMs);

  const result = await db.runAsync(
    `UPDATE sessions
       SET end_time = ?, duration = ?, updated_at = ?
     WHERE id = ? AND end_time IS NULL AND deleted_at IS NULL`,
    endedAt,
    durationSeconds,
    timestamp,
    input.id,
  );

  if (result.changes === 0) {
    throw new Error(`Session ${input.id} is already stopped`);
  }
}

export async function addManualSession(input: {
  id: string;
  client: string;
  client_id?: string | null;
  project_id?: string | null;
  task_id?: string | null;
  start_time: string;
  end_time: string;
  notes?: string | null;
}): Promise<void> {
  const db = await getDb();
  const timestamp = nowIso();
  const durationSeconds = dbDurationMsToSeconds(
    ensureNonNegativeDbDurationMs(input.start_time, input.end_time),
  );

  await db.runAsync(
    `INSERT INTO sessions (
      id,
      client,
      client_id,
      project_id,
      task_id,
      start_time,
      end_time,
      duration,
      notes,
      invoice_id,
      created_at,
      updated_at,
      deleted_at
    )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL)`,
    input.id,
    input.client,
    input.client_id ?? null,
    input.project_id ?? null,
    input.task_id ?? null,
    input.start_time,
    input.end_time,
    durationSeconds,
    input.notes ?? null,
    timestamp,
    timestamp,
  );
}

export async function updateSession(input: {
  id: string;
  client_id: string;
  project_id: string;
  task_id: string;
  start_time: string;
  end_time: string;
  notes?: string | null;
}): Promise<void> {
  const db = await getDb();

  const existingSession = await db.getFirstAsync<Pick<Session, 'id' | 'invoice_id' | 'deleted_at'>>(
    `SELECT id, invoice_id, deleted_at
     FROM sessions
     WHERE id = ?`,
    input.id,
  );

  if (!existingSession || existingSession.deleted_at !== null) {
    throw new Error(`Session ${input.id} not found`);
  }

  if (existingSession.invoice_id !== null) {
    throw new Error('Invoiced sessions are locked and cannot be edited.');
  }

  const client = await db.getFirstAsync<Pick<Client, 'id' | 'name' | 'deleted_at'>>(
    `SELECT id, name, deleted_at
     FROM clients
     WHERE id = ?`,
    input.client_id,
  );

  if (!client || client.deleted_at !== null) {
    throw new Error('Invalid client selection.');
  }

  const project = await db.getFirstAsync<Pick<Project, 'id' | 'deleted_at'>>(
    `SELECT id, deleted_at
     FROM projects
     WHERE id = ?
       AND client_id = ?`,
    input.project_id,
    input.client_id,
  );

  if (!project || project.deleted_at !== null) {
    throw new Error('Invalid project selection for the selected client.');
  }

  const task = await db.getFirstAsync<Pick<Task, 'id' | 'deleted_at'>>(
    `SELECT id, deleted_at
     FROM tasks
     WHERE id = ?
       AND project_id = ?`,
    input.task_id,
    input.project_id,
  );

  if (!task || task.deleted_at !== null) {
    throw new Error('Invalid task selection for the selected project.');
  }

  const startMs = parseDbIsoTimestamp(input.start_time, 'start_time').getTime();
  const endMs = parseDbIsoTimestamp(input.end_time, 'end_time').getTime();
  if (endMs <= startMs) {
    throw new Error('Invalid session time range: end_time must be after start_time');
  }

  const sessionDurationMs = ensureNonNegativeDbDurationMs(input.start_time, input.end_time);
  const breakRows = await db.getAllAsync<Pick<SessionBreak, 'start_time' | 'end_time'>>(
    `SELECT start_time, end_time
     FROM session_breaks
     WHERE session_id = ?
       AND deleted_at IS NULL`,
    input.id,
  );
  const breakDurationMs = computeBreakDurationMs({
    sessionStartIso: input.start_time,
    sessionEndIso: input.end_time,
    breaks: breakRows,
  });
  const billedDurationMs = Math.max(0, sessionDurationMs - breakDurationMs);
  const durationSeconds = dbDurationMsToSeconds(billedDurationMs);
  const timestamp = nowIso();

  const result = await db.runAsync(
    `UPDATE sessions
       SET client = ?,
           client_id = ?,
           project_id = ?,
           task_id = ?,
           start_time = ?,
           end_time = ?,
           duration = ?,
           notes = ?,
           updated_at = ?
     WHERE id = ?
       AND deleted_at IS NULL
       AND invoice_id IS NULL`,
    client.name,
    input.client_id,
    input.project_id,
    input.task_id,
    input.start_time,
    input.end_time,
    durationSeconds,
    input.notes ?? null,
    timestamp,
    input.id,
  );

  if (result.changes === 0) {
    throw new Error('Unable to update session. It may have been invoiced or deleted.');
  }
}

export async function listSessions(): Promise<Session[]> {
  const db = await getDb();
  return db.getAllAsync<Session>(
    `SELECT
       s.id,
       s.client,
       s.client_id,
       s.project_id,
       s.task_id,
       c.name AS client_name,
       p.name AS project_name,
       t.name AS task_name,
       c.github_org AS github_org,
       p.github_repo AS github_repo,
       t.github_branch AS github_branch,
       (
         SELECT COUNT(*)
           FROM session_breaks sb
          WHERE sb.session_id = s.id
            AND sb.deleted_at IS NULL
       ) AS break_count,
       EXISTS (
         SELECT 1
           FROM session_breaks sb
          WHERE sb.session_id = s.id
            AND sb.deleted_at IS NULL
            AND sb.end_time IS NULL
       ) AS is_paused,
       s.start_time,
       s.end_time,
       s.duration,
       s.notes,
       s.commit_sha,
       CASE
         WHEN s.commit_sha IS NOT NULL
           AND c.github_org IS NOT NULL
           AND p.github_repo IS NOT NULL
         THEN 'https://github.com/' || c.github_org || '/' || p.github_repo || '/commit/' || s.commit_sha
         ELSE NULL
       END AS commit_url,
       s.invoice_id,
       s.created_at,
       s.updated_at,
       s.deleted_at
     FROM sessions s
     LEFT JOIN clients c ON c.id = s.client_id
     LEFT JOIN projects p ON p.id = s.project_id
     LEFT JOIN tasks t ON t.id = s.task_id
     WHERE s.deleted_at IS NULL
     ORDER BY s.start_time DESC`,
  );
}

export async function listSessionsByClientAndRange(input: {
  clientId: string;
  rangeStartIso: string;
  rangeEndIso: string;
  uninvoicedOnly?: boolean;
}): Promise<Session[]> {
  const db = await getDb();
  const invoiceFilter = input.uninvoicedOnly ? 'AND s.invoice_id IS NULL' : '';

  return db.getAllAsync<Session>(
    `SELECT
       s.id,
       s.client,
       s.client_id,
       s.project_id,
       s.task_id,
       c.name AS client_name,
       p.name AS project_name,
       t.name AS task_name,
       c.github_org AS github_org,
       p.github_repo AS github_repo,
       t.github_branch AS github_branch,
       (
         SELECT COUNT(*)
           FROM session_breaks sb
          WHERE sb.session_id = s.id
            AND sb.deleted_at IS NULL
       ) AS break_count,
       EXISTS (
         SELECT 1
           FROM session_breaks sb
          WHERE sb.session_id = s.id
            AND sb.deleted_at IS NULL
            AND sb.end_time IS NULL
       ) AS is_paused,
       s.start_time,
       s.end_time,
       s.duration,
       s.notes,
       s.commit_sha,
       CASE
         WHEN s.commit_sha IS NOT NULL
           AND c.github_org IS NOT NULL
           AND p.github_repo IS NOT NULL
         THEN 'https://github.com/' || c.github_org || '/' || p.github_repo || '/commit/' || s.commit_sha
         ELSE NULL
       END AS commit_url,
       s.invoice_id,
       s.created_at,
       s.updated_at,
       s.deleted_at
     FROM sessions s
     LEFT JOIN clients c ON c.id = s.client_id
     LEFT JOIN projects p ON p.id = s.project_id
     LEFT JOIN tasks t ON t.id = s.task_id
     WHERE s.deleted_at IS NULL
       AND s.client_id = ?
       AND s.start_time >= ?
       AND s.start_time < ?
       ${invoiceFilter}
     ORDER BY s.start_time ASC`,
    input.clientId,
    input.rangeStartIso,
    input.rangeEndIso,
  );
}

export async function listSessionsByProject(input: {
  projectId: string;
  uninvoicedOnly?: boolean;
}): Promise<Session[]> {
  const db = await getDb();
  const invoiceFilter = input.uninvoicedOnly ? 'AND s.invoice_id IS NULL' : '';
  return db.getAllAsync<Session>(
    `SELECT
       s.id,
       s.client,
       s.client_id,
       s.project_id,
       s.task_id,
       c.name AS client_name,
       p.name AS project_name,
       t.name AS task_name,
       c.github_org AS github_org,
       p.github_repo AS github_repo,
       t.github_branch AS github_branch,
       (
         SELECT COUNT(*)
           FROM session_breaks sb
          WHERE sb.session_id = s.id
            AND sb.deleted_at IS NULL
       ) AS break_count,
       EXISTS (
         SELECT 1
           FROM session_breaks sb
          WHERE sb.session_id = s.id
            AND sb.deleted_at IS NULL
            AND sb.end_time IS NULL
       ) AS is_paused,
       s.start_time,
       s.end_time,
       s.duration,
       s.notes,
       s.commit_sha,
       CASE
         WHEN s.commit_sha IS NOT NULL
           AND c.github_org IS NOT NULL
           AND p.github_repo IS NOT NULL
         THEN 'https://github.com/' || c.github_org || '/' || p.github_repo || '/commit/' || s.commit_sha
         ELSE NULL
       END AS commit_url,
       s.invoice_id,
       s.created_at,
       s.updated_at,
       s.deleted_at
     FROM sessions s
     LEFT JOIN clients c ON c.id = s.client_id
     LEFT JOIN projects p ON p.id = s.project_id
     LEFT JOIN tasks t ON t.id = s.task_id
     WHERE s.deleted_at IS NULL
       AND s.project_id = ?
       ${invoiceFilter}
     ORDER BY s.start_time ASC`,
    input.projectId,
  );
}

export async function updateSessionNotes(input: {
  id: string;
  notes: string | null;
  commit_sha?: string | null;
}): Promise<void> {
  const db = await getDb();
  const timestamp = nowIso();

  await db.runAsync(
    `UPDATE sessions
       SET notes = ?, commit_sha = ?, updated_at = ?
     WHERE id = ? AND deleted_at IS NULL`,
    input.notes,
    input.commit_sha ?? null,
    timestamp,
    input.id,
  );
}

export async function listSessionBreaksBySessionId(sessionId: string): Promise<SessionBreak[]> {
  const db = await getDb();
  return db.getAllAsync<SessionBreak>(
    `SELECT
       id,
       session_id,
       start_time,
       end_time,
       created_at,
       updated_at,
       deleted_at
     FROM session_breaks
     WHERE session_id = ?
       AND deleted_at IS NULL
     ORDER BY start_time ASC`,
    sessionId,
  );
}

export async function listSessionBreaksBySessionIds(sessionIds: string[]): Promise<SessionBreak[]> {
  if (sessionIds.length === 0) {
    return [];
  }

  const db = await getDb();
  const placeholders = sessionIds.map(() => '?').join(',');
  return db.getAllAsync<SessionBreak>(
    `SELECT
       id,
       session_id,
       start_time,
       end_time,
       created_at,
       updated_at,
       deleted_at
     FROM session_breaks
     WHERE session_id IN (${placeholders})
       AND deleted_at IS NULL
     ORDER BY start_time ASC`,
    ...sessionIds,
  );
}

export async function isSessionPaused(sessionId: string): Promise<boolean> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ is_paused: number }>(
    `SELECT EXISTS (
       SELECT 1
         FROM session_breaks
        WHERE session_id = ?
          AND deleted_at IS NULL
          AND end_time IS NULL
     ) AS is_paused`,
    sessionId,
  );
  return Boolean(row?.is_paused);
}

export async function pauseSession(input: {
  sessionId: string;
  start_time?: string;
}): Promise<void> {
  const db = await getDb();
  const breakStart = input.start_time ?? nowIso();
  const timestamp = nowIso();
  const breakStartMs = parseDbIsoTimestamp(breakStart, 'break_start_time').getTime();

  const session = await db.getFirstAsync<Pick<Session, 'start_time' | 'end_time' | 'deleted_at'>>(
    'SELECT start_time, end_time, deleted_at FROM sessions WHERE id = ?',
    input.sessionId,
  );

  if (!session || session.deleted_at !== null) {
    throw new Error(`Session ${input.sessionId} not found`);
  }

  if (session.end_time) {
    throw new Error('Cannot pause a completed session');
  }

  const sessionStartMs = parseDbIsoTimestamp(session.start_time, 'start_time').getTime();
  if (breakStartMs < sessionStartMs) {
    throw new Error('Cannot pause before the session start time');
  }

  const existingOpenBreak = await db.getFirstAsync<Pick<SessionBreak, 'id'>>(
    `SELECT id
     FROM session_breaks
     WHERE session_id = ?
       AND deleted_at IS NULL
       AND end_time IS NULL
     LIMIT 1`,
    input.sessionId,
  );

  if (existingOpenBreak) {
    throw new Error('Session is already paused');
  }

  await db.runAsync(
    `INSERT INTO session_breaks (
       id,
       session_id,
       start_time,
       end_time,
       created_at,
       updated_at,
       deleted_at
     )
     VALUES (?, ?, ?, NULL, ?, ?, NULL)`,
    createDbId('break'),
    input.sessionId,
    breakStart,
    timestamp,
    timestamp,
  );

  await db.runAsync('UPDATE sessions SET updated_at = ? WHERE id = ?', timestamp, input.sessionId);
}

export async function resumeSession(input: {
  sessionId: string;
  end_time?: string;
}): Promise<void> {
  const db = await getDb();
  const resumeAt = input.end_time ?? nowIso();
  const timestamp = nowIso();
  parseDbIsoTimestamp(resumeAt, 'resume_time');

  const session = await db.getFirstAsync<Pick<Session, 'end_time' | 'deleted_at'>>(
    'SELECT end_time, deleted_at FROM sessions WHERE id = ?',
    input.sessionId,
  );

  if (!session || session.deleted_at !== null) {
    throw new Error(`Session ${input.sessionId} not found`);
  }

  if (session.end_time) {
    throw new Error('Cannot resume a completed session');
  }

  const openBreak = await db.getFirstAsync<Pick<SessionBreak, 'id' | 'start_time'>>(
    `SELECT id, start_time
     FROM session_breaks
     WHERE session_id = ?
       AND deleted_at IS NULL
       AND end_time IS NULL
     ORDER BY start_time DESC
     LIMIT 1`,
    input.sessionId,
  );

  if (!openBreak) {
    throw new Error('Session is not paused');
  }

  const breakStartMs = parseDbIsoTimestamp(openBreak.start_time, 'break.start_time').getTime();
  const resumeAtMs = parseDbIsoTimestamp(resumeAt, 'resume_time').getTime();
  if (resumeAtMs < breakStartMs) {
    throw new Error('Cannot resume before break start time');
  }

  const result = await db.runAsync(
    `UPDATE session_breaks
       SET end_time = ?, updated_at = ?
     WHERE id = ?
       AND end_time IS NULL`,
    resumeAt,
    timestamp,
    openBreak.id,
  );

  if (result.changes === 0) {
    throw new Error('Session is not paused');
  }

  await db.runAsync('UPDATE sessions SET updated_at = ? WHERE id = ?', timestamp, input.sessionId);
}
