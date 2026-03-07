import type { Session } from '@/database/db';

const STORAGE_KEY = 'time2pay.sessions';

function nowIso(): string {
  return new Date().toISOString();
}

function readSessions(): Session[] {
  if (typeof localStorage === 'undefined') {
    return [];
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    return JSON.parse(raw) as Session[];
  } catch {
    return [];
  }
}

function writeSessions(sessions: Session[]): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

export async function listRuntimeSessions(): Promise<Session[]> {
  return readSessions().sort((a, b) => (a.start_time < b.start_time ? 1 : -1));
}

export async function startRuntimeSession(input: {
  id: string;
  client: string;
  notes?: string | null;
}): Promise<void> {
  const timestamp = nowIso();
  const sessions = readSessions();
  sessions.push({
    id: input.id,
    client: input.client,
    start_time: timestamp,
    end_time: null,
    duration: null,
    notes: input.notes ?? null,
    invoice_id: null,
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: null,
  });

  writeSessions(sessions);
}

export async function stopRuntimeSession(sessionId: string): Promise<void> {
  const sessions = readSessions();
  const index = sessions.findIndex((session) => session.id === sessionId);

  if (index < 0) {
    throw new Error(`Session ${sessionId} not found`);
  }

  const existing = sessions[index];
  if (existing.end_time) {
    throw new Error(`Session ${sessionId} already stopped`);
  }

  const endTime = nowIso();
  const duration = Math.max(
    0,
    Math.round((new Date(endTime).getTime() - new Date(existing.start_time).getTime()) / 1000),
  );

  sessions[index] = {
    ...existing,
    end_time: endTime,
    duration,
    updated_at: endTime,
  };

  writeSessions(sessions);
}
