import { sql } from 'drizzle-orm';
import type { WriteDb } from '@/app/api/db/_shared/db';
import { conflict, notFound, validation } from '@/app/api/db/_shared/errors';
import { assertInvoiceUnlocked, assertUpdated } from '@/app/api/db/_queries/_shared';
import { makeEphemeralId, nowIso, toIsoOrNow } from '@/app/api/db/_shared/parsers';

export type StartSessionInput = {
  id: string;
  client: string;
  clientId?: string | null;
  projectId?: string | null;
  taskId?: string | null;
  startTime?: string;
  notes?: string | null;
};

type SessionRelationIds = {
  clientId?: string | null;
  projectId?: string | null;
  taskId?: string | null;
};

function rowsFromResult(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) {
    return result as Record<string, unknown>[];
  }
  if (result && typeof result === 'object') {
    const rows = (result as { rows?: unknown[] }).rows;
    if (Array.isArray(rows)) {
      return rows as Record<string, unknown>[];
    }
  }
  return [];
}

async function requireActiveRelations(
  db: WriteDb,
  authUserId: string,
  ids: SessionRelationIds,
): Promise<{ clientName?: string }> {
  let clientName: string | undefined;

  if (ids.clientId) {
    const clientResult = await db.execute(sql`
      select id, name
      from clients
      where id = ${ids.clientId}
        and auth_user_id = ${authUserId}::uuid
        and deleted_at is null
      limit 1
    `);
    const clientRows = rowsFromResult(clientResult);
    if (clientRows.length === 0) {
      throw notFound('Client not found.');
    }
    clientName = String(clientRows[0].name);
  }

  if (ids.projectId) {
    const projectResult = await db.execute(sql`
      select id
      from projects
      where id = ${ids.projectId}
        and auth_user_id = ${authUserId}::uuid
        and deleted_at is null
        and (${ids.clientId}::text is null or client_id = ${ids.clientId})
      limit 1
    `);
    const projectRows = rowsFromResult(projectResult);
    if (projectRows.length === 0) {
      throw notFound('Project not found for selected client.');
    }
  }

  if (ids.taskId) {
    const taskResult = await db.execute(sql`
      select id
      from tasks
      where id = ${ids.taskId}
        and auth_user_id = ${authUserId}::uuid
        and deleted_at is null
        and (${ids.projectId}::text is null or project_id = ${ids.projectId})
      limit 1
    `);
    const taskRows = rowsFromResult(taskResult);
    if (taskRows.length === 0) {
      throw notFound('Task not found for selected project.');
    }
  }

  return { clientName };
}

function parseDurationSeconds(startIso: string, endIso: string): number {
  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    throw validation('Invalid session time range: endTime must be after startTime.');
  }
  return Math.round((endMs - startMs) / 1000);
}

type SessionBreakInterval = {
  start_time: string;
  end_time: string | null;
};

function parseIsoMs(value: string, fieldName: string): number {
  const parsed = new Date(value);
  const ms = parsed.getTime();
  if (!Number.isFinite(ms)) {
    throw validation(`Invalid ${fieldName}: expected ISO-8601 timestamp.`);
  }
  return ms;
}

function ensureNonNegativeDurationMs(startIso: string, endIso: string): number {
  const startMs = parseIsoMs(startIso, 'start_time');
  const endMs = parseIsoMs(endIso, 'end_time');
  const durationMs = endMs - startMs;
  if (durationMs < 0) {
    throw validation('Invalid session time range: endTime must be after startTime.');
  }
  return durationMs;
}

function computeBreakDurationMsForSession(
  sessionStartIso: string,
  sessionEndIso: string,
  breaks: SessionBreakInterval[],
): number {
  const sessionStartMs = parseIsoMs(sessionStartIso, 'start_time');
  const sessionEndMs = parseIsoMs(sessionEndIso, 'end_time');

  if (sessionEndMs <= sessionStartMs) {
    return 0;
  }

  const clampedIntervals = breaks
    .map((sessionBreak) => {
      if (!sessionBreak.end_time) {
        return null;
      }

      const breakStartMs = parseIsoMs(sessionBreak.start_time, 'break.start_time');
      const breakEndMs = parseIsoMs(sessionBreak.end_time, 'break.end_time');
      if (breakEndMs < breakStartMs) {
        throw validation('Invalid break interval: end_time must be after start_time');
      }

      const intervalStart = Math.max(sessionStartMs, breakStartMs);
      const intervalEnd = Math.min(sessionEndMs, breakEndMs);
      if (intervalEnd <= intervalStart) {
        return null;
      }

      return [intervalStart, intervalEnd] as const;
    })
    .filter((interval): interval is readonly [number, number] => interval !== null)
    .sort((a, b) => a[0] - b[0]);

  if (clampedIntervals.length === 0) {
    return 0;
  }

  let mergedStart = clampedIntervals[0][0];
  let mergedEnd = clampedIntervals[0][1];
  let totalMs = 0;

  for (let i = 1; i < clampedIntervals.length; i += 1) {
    const [start, end] = clampedIntervals[i];
    if (start > mergedEnd) {
      totalMs += mergedEnd - mergedStart;
      mergedStart = start;
      mergedEnd = end;
    } else if (end > mergedEnd) {
      mergedEnd = end;
    }
  }

  totalMs += mergedEnd - mergedStart;
  return totalMs;
}

function computeBilledDurationSeconds(
  sessionStartIso: string,
  sessionEndIso: string,
  breaks: SessionBreakInterval[],
): number {
  const sessionDurationMs = ensureNonNegativeDurationMs(sessionStartIso, sessionEndIso);
  const breakDurationMs = computeBreakDurationMsForSession(sessionStartIso, sessionEndIso, breaks);
  const billedMs = Math.max(0, sessionDurationMs - breakDurationMs);
  return Math.round(billedMs / 1000);
}

export async function startSession(
  db: WriteDb,
  authUserId: string,
  input: StartSessionInput,
): Promise<void> {
  if (!input.id.trim() || !input.client.trim()) {
    throw validation('Session id and client label are required.');
  }

  const { clientName } = await requireActiveRelations(db, authUserId, {
    clientId: input.clientId ?? null,
    projectId: input.projectId ?? null,
    taskId: input.taskId ?? null,
  });
  const timestamp = nowIso();
  const startedAt = toIsoOrNow(input.startTime ?? null);
  await db.execute(sql`
    insert into sessions (
      id, auth_user_id, client, client_id, project_id, task_id, start_time, end_time,
      duration, notes, commit_sha, invoice_id, created_at, updated_at, deleted_at
    ) values (
      ${input.id},
      ${authUserId}::uuid,
      ${clientName ?? input.client},
      ${input.clientId ?? null},
      ${input.projectId ?? null},
      ${input.taskId ?? null},
      ${startedAt},
      null,
      null,
      ${input.notes ?? null},
      null,
      null,
      ${timestamp},
      ${timestamp},
      null
    )
  `);
}

export type StopSessionInput = {
  id: string;
  endTime?: string;
};

export async function stopSession(
  db: WriteDb,
  authUserId: string,
  input: StopSessionInput,
): Promise<void> {
  const timestamp = nowIso();
  let endTime: string;
  try {
    endTime = toIsoOrNow(input.endTime ?? null);
  } catch (error) {
    throw validation(error instanceof Error ? error.message : 'Invalid end time.');
  }

  try {
    await db.transaction(async (tx) => {
      const sessionResult = await tx.execute(sql`
        select start_time, end_time
        from sessions
        where id = ${input.id}
          and auth_user_id = ${authUserId}::uuid
          and deleted_at is null
        limit 1
      `);
      const sessionRows = rowsFromResult(sessionResult);
      if (sessionRows.length === 0) {
        throw notFound('Active session not found.');
      }

      const sessionRow = sessionRows[0] as { start_time: string; end_time?: string | null };
      if (sessionRow.end_time) {
        throw conflict('Session is already stopped.');
      }

      const startTime = String(sessionRow.start_time);

      const openBreakResult = await tx.execute(sql`
        select id, start_time
        from session_breaks
        where session_id = ${input.id}
          and auth_user_id = ${authUserId}::uuid
          and deleted_at is null
          and end_time is null
        order by start_time desc
        limit 1
      `);
      const openBreakRows = rowsFromResult(openBreakResult) as {
        id: string;
        start_time: string;
      }[];
      if (openBreakRows.length > 0) {
        const breakStartIso = String(openBreakRows[0].start_time);
        const breakStartMs = new Date(breakStartIso).getTime();
        const endMs = new Date(endTime).getTime();
        if (!Number.isFinite(endMs) || endMs < breakStartMs) {
          throw validation('Cannot clock out before active break start.');
        }

        await assertUpdated(
          tx,
          sql`
            update session_breaks
            set end_time = ${endTime}, updated_at = ${timestamp}
            where id = ${String(openBreakRows[0].id)}
              and auth_user_id = ${authUserId}::uuid
              and end_time is null
            returning id
          `,
          'Session is not paused.',
        );
      }

      const billedSeconds = computeBilledDurationSeconds(
        startTime,
        endTime,
        rowsFromResult(
          await tx.execute(sql`
            select start_time, end_time
            from session_breaks
            where session_id = ${input.id}
              and auth_user_id = ${authUserId}::uuid
              and deleted_at is null
          `),
        ).map((row) => {
          const { start_time, end_time } = row as { start_time: string; end_time: string | null };
          return {
            start_time: String(start_time),
            end_time: (end_time ?? null) as string | null,
          };
        }),
      );

      await assertUpdated(
        tx,
        sql`
          update sessions
          set end_time = ${endTime}, duration = ${billedSeconds}, updated_at = ${timestamp}
          where id = ${input.id}
            and auth_user_id = ${authUserId}::uuid
            and deleted_at is null
            and end_time is null
          returning id
        `,
        'Active session not found.',
      );
    });
  } catch (error) {
    const pgCode = (error as { code?: unknown }).code;
    if (typeof pgCode === 'string' && /^[0-9]{5}$/.test(pgCode)) {
      throw conflict('Unable to stop session due to a database constraint.');
    }
    throw error;
  }
}

export type AddManualSessionInput = {
  id: string;
  client: string;
  clientId?: string | null;
  projectId?: string | null;
  taskId?: string | null;
  startTime: string;
  endTime: string;
  notes?: string | null;
};

export async function addManualSession(
  db: WriteDb,
  authUserId: string,
  input: AddManualSessionInput,
): Promise<void> {
  if (!input.id.trim() || !input.client.trim()) {
    throw validation('Session id and client label are required.');
  }

  const { clientName } = await requireActiveRelations(db, authUserId, {
    clientId: input.clientId ?? null,
    projectId: input.projectId ?? null,
    taskId: input.taskId ?? null,
  });
  const timestamp = nowIso();
  const startTime = toIsoOrNow(input.startTime);
  const endTime = toIsoOrNow(input.endTime);
  const durationSeconds = parseDurationSeconds(startTime, endTime);
  await db.execute(sql`
    insert into sessions (
      id, auth_user_id, client, client_id, project_id, task_id, start_time, end_time,
      duration, notes, commit_sha, invoice_id, created_at, updated_at, deleted_at
    ) values (
      ${input.id},
      ${authUserId}::uuid,
      ${clientName ?? input.client},
      ${input.clientId ?? null},
      ${input.projectId ?? null},
      ${input.taskId ?? null},
      ${startTime},
      ${endTime},
      ${durationSeconds},
      ${input.notes ?? null},
      null,
      null,
      ${timestamp},
      ${timestamp},
      null
    )
  `);
}

export type UpdateSessionInput = {
  id: string;
  clientId: string;
  projectId: string;
  taskId: string;
  startTime: string;
  endTime: string;
  notes?: string | null;
};

export async function updateSession(
  db: WriteDb,
  authUserId: string,
  input: UpdateSessionInput,
): Promise<void> {
  await assertInvoiceUnlocked(db, authUserId, input.id);
  const { clientName } = await requireActiveRelations(db, authUserId, {
    clientId: input.clientId,
    projectId: input.projectId,
    taskId: input.taskId,
  });

  const startTime = toIsoOrNow(input.startTime);
  const endTime = toIsoOrNow(input.endTime);
  const durationSeconds = parseDurationSeconds(startTime, endTime);
  const timestamp = nowIso();

  await assertUpdated(
    db,
    sql`
      update sessions
      set
        client = ${clientName ?? ''},
        client_id = ${input.clientId},
        project_id = ${input.projectId},
        task_id = ${input.taskId},
        start_time = ${startTime},
        end_time = ${endTime},
        duration = ${durationSeconds},
        notes = ${input.notes ?? null},
        updated_at = ${timestamp}
      where id = ${input.id}
        and auth_user_id = ${authUserId}::uuid
        and deleted_at is null
        and invoice_id is null
      returning id
    `,
    'Unable to update session.',
  );
}

export type UpdateSessionNotesInput = {
  id: string;
  notes: string | null;
  commitSha?: string | null;
};

export async function updateSessionNotes(
  db: WriteDb,
  authUserId: string,
  input: UpdateSessionNotesInput,
): Promise<void> {
  await assertInvoiceUnlocked(db, authUserId, input.id);

  const timestamp = nowIso();
  await assertUpdated(
    db,
    sql`
      update sessions
      set
        notes = ${input.notes},
        commit_sha = ${input.commitSha ?? null},
        updated_at = ${timestamp}
      where id = ${input.id}
        and auth_user_id = ${authUserId}::uuid
        and deleted_at is null
      returning id
    `,
    'Session not found.',
  );
}

export type PauseSessionInput = {
  sessionId: string;
  startTime?: string;
};

export async function pauseSession(
  db: WriteDb,
  authUserId: string,
  input: PauseSessionInput,
): Promise<void> {
  const timestamp = nowIso();
  const breakStart = toIsoOrNow(input.startTime ?? null);

  await db.transaction(async (tx) => {
    const sessionResult = await tx.execute(sql`
      select id, start_time, end_time
      from sessions
      where id = ${input.sessionId}
        and auth_user_id = ${authUserId}::uuid
        and deleted_at is null
      limit 1
    `);
    const sessionRows = rowsFromResult(sessionResult);
    if (sessionRows.length === 0) {
      throw notFound('Session not found.');
    }
    if (sessionRows[0].end_time) {
      throw conflict('Cannot pause a completed session.');
    }

    const openBreakResult = await tx.execute(sql`
      select id
      from session_breaks
      where session_id = ${input.sessionId}
        and auth_user_id = ${authUserId}::uuid
        and deleted_at is null
        and end_time is null
      limit 1
    `);
    if (rowsFromResult(openBreakResult).length > 0) {
      throw conflict('Session is already paused.');
    }

    await tx.execute(sql`
      insert into session_breaks (
        id, auth_user_id, session_id, start_time, end_time, created_at, updated_at, deleted_at
      ) values (
        ${makeEphemeralId('break')},
        ${authUserId}::uuid,
        ${input.sessionId},
        ${breakStart},
        null,
        ${timestamp},
        ${timestamp},
        null
      )
    `);

    await assertUpdated(
      tx,
      sql`
        update sessions
        set updated_at = ${timestamp}
        where id = ${input.sessionId}
          and auth_user_id = ${authUserId}::uuid
          and deleted_at is null
        returning id
      `,
      'Session not found.',
    );
  });
}

export type ResumeSessionInput = {
  sessionId: string;
  endTime?: string;
};

export async function resumeSession(
  db: WriteDb,
  authUserId: string,
  input: ResumeSessionInput,
): Promise<void> {
  const timestamp = nowIso();
  const resumeAt = toIsoOrNow(input.endTime ?? null);

  await db.transaction(async (tx) => {
    const sessionResult = await tx.execute(sql`
      select id, end_time
      from sessions
      where id = ${input.sessionId}
        and auth_user_id = ${authUserId}::uuid
        and deleted_at is null
      limit 1
    `);
    const sessionRows = rowsFromResult(sessionResult);
    if (sessionRows.length === 0) {
      throw notFound('Session not found.');
    }
    if (sessionRows[0].end_time) {
      throw conflict('Cannot resume a completed session.');
    }

    const openBreakResult = await tx.execute(sql`
      select id, start_time
      from session_breaks
      where session_id = ${input.sessionId}
        and auth_user_id = ${authUserId}::uuid
        and deleted_at is null
        and end_time is null
      order by start_time desc
      limit 1
    `);
    const openBreakRows = rowsFromResult(openBreakResult);
    if (openBreakRows.length === 0) {
      throw conflict('Session is not paused.');
    }

    const breakStart = new Date(String(openBreakRows[0].start_time));
    const breakEnd = new Date(resumeAt);
    if (breakEnd.getTime() < breakStart.getTime()) {
      throw validation('Cannot resume before break start time.');
    }

    await assertUpdated(
      tx,
      sql`
        update session_breaks
        set end_time = ${resumeAt}, updated_at = ${timestamp}
        where id = ${String(openBreakRows[0].id)}
          and auth_user_id = ${authUserId}::uuid
          and end_time is null
        returning id
      `,
      'Session is not paused.',
    );

    await assertUpdated(
      tx,
      sql`
        update sessions
        set updated_at = ${timestamp}
        where id = ${input.sessionId}
          and auth_user_id = ${authUserId}::uuid
          and deleted_at is null
        returning id
      `,
      'Session not found.',
    );
  });
}
