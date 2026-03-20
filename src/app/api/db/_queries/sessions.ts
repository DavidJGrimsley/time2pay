import { sql } from 'drizzle-orm';
import type { WriteDb } from '@/app/api/db/_shared/db';
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

export async function startSession(
  db: WriteDb,
  authUserId: string,
  input: StartSessionInput,
): Promise<void> {
  const timestamp = nowIso();
  await db.execute(sql`
    insert into sessions (
      id, auth_user_id, client, client_id, project_id, task_id, start_time, end_time,
      duration, notes, commit_sha, invoice_id, created_at, updated_at, deleted_at
    ) values (
      ${input.id},
      ${authUserId}::uuid,
      ${input.client},
      ${input.clientId ?? null},
      ${input.projectId ?? null},
      ${input.taskId ?? null},
      ${toIsoOrNow(input.startTime ?? null)},
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
  await db.execute(sql`
    update sessions
    set end_time = ${toIsoOrNow(input.endTime ?? null)}, updated_at = ${timestamp}
    where id = ${input.id}
      and auth_user_id = ${authUserId}::uuid
      and deleted_at is null
      and end_time is null
  `);
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
  const timestamp = nowIso();
  const startTime = toIsoOrNow(input.startTime);
  const endTime = toIsoOrNow(input.endTime);
  const durationSeconds = Math.max(
    0,
    Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000),
  );
  await db.execute(sql`
    insert into sessions (
      id, auth_user_id, client, client_id, project_id, task_id, start_time, end_time,
      duration, notes, commit_sha, invoice_id, created_at, updated_at, deleted_at
    ) values (
      ${input.id},
      ${authUserId}::uuid,
      ${input.client},
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
  const timestamp = nowIso();
  await db.execute(sql`
    update sessions
    set
      client_id = ${input.clientId},
      project_id = ${input.projectId},
      task_id = ${input.taskId},
      start_time = ${toIsoOrNow(input.startTime)},
      end_time = ${toIsoOrNow(input.endTime)},
      notes = ${input.notes ?? null},
      updated_at = ${timestamp}
    where id = ${input.id}
      and auth_user_id = ${authUserId}::uuid
      and deleted_at is null
  `);
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
  const timestamp = nowIso();
  await db.execute(sql`
    update sessions
    set
      notes = ${input.notes},
      commit_sha = ${input.commitSha ?? null},
      updated_at = ${timestamp}
    where id = ${input.id}
      and auth_user_id = ${authUserId}::uuid
      and deleted_at is null
  `);
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
  await db.execute(sql`
    insert into session_breaks (
      id, auth_user_id, session_id, start_time, end_time, created_at, updated_at, deleted_at
    ) values (
      ${makeEphemeralId('break')},
      ${authUserId}::uuid,
      ${input.sessionId},
      ${toIsoOrNow(input.startTime ?? null)},
      null,
      ${timestamp},
      ${timestamp},
      null
    )
  `);
  await db.execute(sql`
    update sessions
    set updated_at = ${timestamp}
    where id = ${input.sessionId}
      and auth_user_id = ${authUserId}::uuid
  `);
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
  const endTime = toIsoOrNow(input.endTime ?? null);
  await db.execute(sql`
    update session_breaks
    set end_time = ${endTime}, updated_at = ${timestamp}
    where id in (
      select id
      from session_breaks
      where session_id = ${input.sessionId}
        and auth_user_id = ${authUserId}::uuid
        and deleted_at is null
        and end_time is null
      order by start_time desc
      limit 1
    )
  `);
  await db.execute(sql`
    update sessions
    set updated_at = ${timestamp}
    where id = ${input.sessionId}
      and auth_user_id = ${authUserId}::uuid
  `);
}
