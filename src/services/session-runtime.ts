import {
  addManualSession,
  initializeDatabase,
  isSessionPaused,
  listSessions,
  listSessionBreaksBySessionId,
  pauseSession,
  resumeSession,
  startSession,
  stopSession,
  updateSession,
  type Session,
  type SessionBreak,
} from '@/database/db';

let initialized = false;

async function ensureDatabaseReady(): Promise<void> {
  if (initialized) {
    return;
  }

  await initializeDatabase();
  initialized = true;
}

export async function listRuntimeSessions(): Promise<Session[]> {
  await ensureDatabaseReady();
  return listSessions();
}

export type RuntimeSessionState = {
  runningSession: Session | null;
  paused: boolean;
  breaks: SessionBreak[];
};

export async function getRuntimeSessionState(): Promise<RuntimeSessionState> {
  await ensureDatabaseReady();

  const sessions = await listSessions();
  const runningSession = sessions.find((session) => session.end_time === null) ?? null;

  if (!runningSession) {
    return {
      runningSession: null,
      paused: false,
      breaks: [],
    };
  }

  const [paused, breaks] = await Promise.all([
    isSessionPaused(runningSession.id),
    listSessionBreaksBySessionId(runningSession.id),
  ]);

  return {
    runningSession,
    paused,
    breaks,
  };
}

export async function startRuntimeSession(input: {
  id: string;
  client: string;
  clientId?: string | null;
  projectId?: string | null;
  taskId?: string | null;
  notes?: string | null;
}): Promise<void> {
  await ensureDatabaseReady();

  const sessions = await listSessions();
  const runningSession = sessions.find((session) => session.end_time === null);
  if (runningSession) {
    throw new Error('A session is already running. Clock out first.');
  }

  await startSession({
    id: input.id,
    client: input.client,
    client_id: input.clientId ?? null,
    project_id: input.projectId ?? null,
    task_id: input.taskId ?? null,
    notes: input.notes ?? null,
  });
}

export async function stopRuntimeSession(sessionId: string): Promise<void> {
  await ensureDatabaseReady();
  await stopSession({ id: sessionId });
}

export async function pauseRuntimeSession(sessionId: string): Promise<void> {
  await ensureDatabaseReady();
  await pauseSession({ sessionId });
}

export async function resumeRuntimeSession(sessionId: string): Promise<void> {
  await ensureDatabaseReady();
  await resumeSession({ sessionId });
}

export async function createRuntimeManualSession(input: {
  id: string;
  client: string;
  clientId?: string | null;
  projectId?: string | null;
  taskId?: string | null;
  startTimeIso: string;
  endTimeIso: string;
  notes?: string | null;
}): Promise<void> {
  await ensureDatabaseReady();

  await addManualSession({
    id: input.id,
    client: input.client,
    client_id: input.clientId ?? null,
    project_id: input.projectId ?? null,
    task_id: input.taskId ?? null,
    start_time: input.startTimeIso,
    end_time: input.endTimeIso,
    notes: input.notes ?? null,
  });
}

export async function updateRuntimeSession(input: {
  id: string;
  clientId: string;
  projectId: string;
  taskId: string;
  startTimeIso: string;
  endTimeIso: string;
  notes?: string | null;
}): Promise<void> {
  await ensureDatabaseReady();

  await updateSession({
    id: input.id,
    client_id: input.clientId,
    project_id: input.projectId,
    task_id: input.taskId,
    start_time: input.startTimeIso,
    end_time: input.endTimeIso,
    notes: input.notes ?? null,
  });
}
