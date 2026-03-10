import * as SQLite from 'expo-sqlite';

export type Session = {
  id: string;
  client: string;
  client_id: string | null;
  project_id: string | null;
  task_id: string | null;
  client_name?: string | null;
  project_name?: string | null;
  task_name?: string | null;
  github_org?: string | null;
  github_repo?: string | null;
  github_branch?: string | null;
  break_count?: number;
  is_paused?: number;
  start_time: string;
  end_time: string | null;
  duration: number | null;
  notes: string | null;
  commit_sha: string | null;
  commit_url?: string | null;
  invoice_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type Client = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  hourly_rate: number;
  github_org: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type Project = {
  id: string;
  client_id: string;
  name: string;
  github_repo: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type Task = {
  id: string;
  project_id: string;
  name: string;
  github_branch: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type Invoice = {
  id: string;
  client_id: string;
  total: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  mercury_invoice_id: string | null;
  payment_link: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type InvoiceWithClient = Invoice & {
  client_name?: string | null;
  client_email?: string | null;
  client_phone?: string | null;
  client_hourly_rate?: number | null;
};

export type UserProfile = {
  id: string;
  company_name: string | null;
  logo_url: string | null;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
};

export type SessionBreak = {
  id: string;
  session_id: string;
  start_time: string;
  end_time: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type CoreDbValidationReport = {
  schemaVersion: number;
  startedSessionId: string;
  manualSessionId: string;
  invoiceId: string;
  linkedSessionCount: number;
};

const DB_NAME = 'time2pay.db';
const SCHEMA_VERSION = 7;
const USER_PROFILE_ID = 'me';

const MIGRATIONS: { version: number; upSql: string }[] = [
  {
    version: 1,
    upSql: `
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS clients (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        email TEXT,
        hourly_rate REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY NOT NULL,
        client_id TEXT NOT NULL,
        total REAL NOT NULL,
        status TEXT NOT NULL,
        mercury_invoice_id TEXT,
        payment_link TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (client_id) REFERENCES clients(id)
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY NOT NULL,
        client TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT,
        duration INTEGER,
        notes TEXT,
        invoice_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (invoice_id) REFERENCES invoices(id)
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time);
      CREATE INDEX IF NOT EXISTS idx_sessions_invoice_id ON sessions(invoice_id);
      CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);
    `,
  },
  {
    version: 2,
    upSql: `
      ALTER TABLE clients ADD COLUMN deleted_at TEXT;
      ALTER TABLE invoices ADD COLUMN deleted_at TEXT;
      ALTER TABLE sessions ADD COLUMN deleted_at TEXT;
    `,
  },
  {
    version: 3,
    upSql: `
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY NOT NULL,
        client_id TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        FOREIGN KEY (client_id) REFERENCES clients(id)
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY NOT NULL,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        FOREIGN KEY (project_id) REFERENCES projects(id)
      );

      ALTER TABLE sessions ADD COLUMN client_id TEXT;
      ALTER TABLE sessions ADD COLUMN project_id TEXT;
      ALTER TABLE sessions ADD COLUMN task_id TEXT;

      UPDATE sessions
         SET client_id = (
           SELECT c.id
             FROM clients c
            WHERE c.name = sessions.client
            LIMIT 1
         )
       WHERE client_id IS NULL;

      CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects(client_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_client_id ON sessions(client_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_project_id ON sessions(project_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_task_id ON sessions(task_id);
    `,
  },
  {
    version: 4,
    upSql: `
      CREATE TABLE IF NOT EXISTS session_breaks (
        id TEXT PRIMARY KEY NOT NULL,
        session_id TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      );

      CREATE INDEX IF NOT EXISTS idx_session_breaks_session_id ON session_breaks(session_id);
      CREATE INDEX IF NOT EXISTS idx_session_breaks_start_time ON session_breaks(start_time);
      CREATE INDEX IF NOT EXISTS idx_session_breaks_end_time ON session_breaks(end_time);
    `,
  },
  {
    version: 5,
    upSql: `
      ALTER TABLE clients ADD COLUMN github_org TEXT;
      ALTER TABLE projects ADD COLUMN github_repo TEXT;
      ALTER TABLE tasks ADD COLUMN github_branch TEXT;
      ALTER TABLE sessions ADD COLUMN commit_sha TEXT;
    `,
  },
  {
    version: 6,
    upSql: `
      ALTER TABLE clients ADD COLUMN phone TEXT;

      CREATE TABLE IF NOT EXISTS user_profile (
        id TEXT PRIMARY KEY NOT NULL,
        company_name TEXT,
        logo_url TEXT,
        full_name TEXT,
        phone TEXT,
        email TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
  },
  {
    version: 7,
    upSql: `
      ALTER TABLE user_profile ADD COLUMN mercury_api_key TEXT;
    `,
  },
];

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function nowIso(): string {
  return new Date().toISOString();
}

function createDbId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function buildTestId(prefix: string): string {
  return createDbId(prefix);
}

function parseDbIsoTimestamp(input: string, fieldName: string): Date {
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid ${fieldName}: expected ISO-8601 timestamp`);
  }
  return parsed;
}

function ensureNonNegativeDbDurationMs(start: string, end: string): number {
  const startDate = parseDbIsoTimestamp(start, 'start_time');
  const endDate = parseDbIsoTimestamp(end, 'end_time');
  const durationMs = endDate.getTime() - startDate.getTime();

  if (durationMs < 0) {
    throw new Error('Invalid session time range: end_time must be after start_time');
  }

  return durationMs;
}

function dbDurationMsToSeconds(durationMs: number): number {
  return Math.round(durationMs / 1000);
}

function computeBreakDurationMs(input: {
  sessionStartIso: string;
  sessionEndIso: string;
  breaks: Pick<SessionBreak, 'start_time' | 'end_time'>[];
}): number {
  const sessionStartMs = parseDbIsoTimestamp(input.sessionStartIso, 'start_time').getTime();
  const sessionEndMs = parseDbIsoTimestamp(input.sessionEndIso, 'end_time').getTime();

  if (sessionEndMs <= sessionStartMs) {
    return 0;
  }

  const clampedIntervals = input.breaks
    .map((sessionBreak) => {
      if (!sessionBreak.end_time) {
        return null;
      }

      const breakStartMs = parseDbIsoTimestamp(sessionBreak.start_time, 'break.start_time').getTime();
      const breakEndMs = parseDbIsoTimestamp(sessionBreak.end_time, 'break.end_time').getTime();
      if (breakEndMs < breakStartMs) {
        throw new Error('Invalid break interval: end_time must be after start_time');
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
  return totalMs;
}

function assertDbInvoiceTotal(total: number): void {
  if (!Number.isFinite(total) || total < 0) {
    throw new Error('Invalid invoice total: expected a non-negative finite number');
  }
}

async function getUserVersion(db: SQLite.SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  return row?.user_version ?? 0;
}

async function runMigrations(db: SQLite.SQLiteDatabase): Promise<number> {
  const currentVersion = await getUserVersion(db);
  const pending = MIGRATIONS.filter((migration) => migration.version > currentVersion);

  for (const migration of pending) {
    await db.execAsync('BEGIN;');
    try {
      await db.execAsync(migration.upSql);
      await db.execAsync(`PRAGMA user_version = ${migration.version};`);
      await db.execAsync('COMMIT;');
    } catch (error) {
      await db.execAsync('ROLLBACK;');
      throw error;
    }
  }

  return getUserVersion(db);
}

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await db.execAsync('PRAGMA foreign_keys = ON;');
      await db.execAsync('PRAGMA journal_mode = WAL;');
      return db;
    })();
  }
  return dbPromise;
}

export async function initializeDatabase(): Promise<void> {
  const db = await getDb();
  const finalVersion = await runMigrations(db);

  if (finalVersion !== SCHEMA_VERSION) {
    throw new Error(
      `Schema migration mismatch: expected version ${SCHEMA_VERSION}, got ${finalVersion}`,
    );
  }

  await ensureUserProfileRow(db);
}

export async function getCurrentSchemaVersion(): Promise<number> {
  const db = await getDb();
  return getUserVersion(db);
}

export async function createClient(input: {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  hourly_rate?: number;
  github_org?: string | null;
}): Promise<void> {
  const db = await getDb();
  const timestamp = nowIso();

  await db.runAsync(
    `INSERT INTO clients (id, name, email, phone, hourly_rate, github_org, created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    input.id,
    input.name,
    input.email ?? null,
    input.phone ?? null,
    input.hourly_rate ?? 0,
    input.github_org ?? null,
    timestamp,
    timestamp,
    null,
  );
}

export async function listClients(): Promise<Client[]> {
  const db = await getDb();
  return db.getAllAsync<Client>(
    `SELECT id, name, email, phone, hourly_rate, github_org, created_at, updated_at, deleted_at
     FROM clients
     WHERE deleted_at IS NULL
     ORDER BY name COLLATE NOCASE ASC`,
  );
}

export async function getClientById(clientId: string): Promise<Client | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<Client>(
    `SELECT id, name, email, phone, hourly_rate, github_org, created_at, updated_at, deleted_at
     FROM clients
     WHERE id = ? AND deleted_at IS NULL`,
    clientId,
  );
  return row ?? null;
}

async function ensureUserProfileRow(db: SQLite.SQLiteDatabase): Promise<void> {
  const timestamp = nowIso();
  await db.runAsync(
    `INSERT OR IGNORE INTO user_profile (
       id,
       company_name,
       logo_url,
       full_name,
       phone,
       email,
       created_at,
       updated_at
     )
     VALUES (?, NULL, NULL, NULL, NULL, NULL, ?, ?)`,
    USER_PROFILE_ID,
    timestamp,
    timestamp,
  );
}

export async function getUserProfile(): Promise<UserProfile> {
  const db = await getDb();
  await ensureUserProfileRow(db);
  const row = await db.getFirstAsync<UserProfile>(
    `SELECT
       id,
       company_name,
       logo_url,
       full_name,
       phone,
       email,
       created_at,
       updated_at
     FROM user_profile
     WHERE id = ?`,
    USER_PROFILE_ID,
  );

  if (!row) {
    throw new Error('User profile could not be loaded');
  }

  return row;
}

export async function upsertUserProfile(input: {
  company_name?: string | null;
  logo_url?: string | null;
  full_name?: string | null;
  phone?: string | null;
  email?: string | null;
}): Promise<void> {
  const db = await getDb();
  await ensureUserProfileRow(db);
  const timestamp = nowIso();

  await db.runAsync(
    `UPDATE user_profile
       SET company_name = ?,
           logo_url = ?,
           full_name = ?,
           phone = ?,
           email = ?,
           updated_at = ?
     WHERE id = ?`,
    input.company_name ?? null,
    input.logo_url ?? null,
    input.full_name ?? null,
    input.phone ?? null,
    input.email ?? null,
    timestamp,
    USER_PROFILE_ID,
  );
}

export async function updateClientInvoiceContact(input: {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
}): Promise<void> {
  const db = await getDb();
  const timestamp = nowIso();
  const result = await db.runAsync(
    `UPDATE clients
       SET name = ?,
           email = ?,
           phone = ?,
           updated_at = ?
     WHERE id = ?
       AND deleted_at IS NULL`,
    input.name,
    input.email ?? null,
    input.phone ?? null,
    timestamp,
    input.id,
  );

  if (result.changes === 0) {
    throw new Error('Client not found');
  }
}

export async function createProject(input: {
  id: string;
  client_id: string;
  name: string;
  github_repo?: string | null;
}): Promise<void> {
  const db = await getDb();
  const timestamp = nowIso();

  await db.runAsync(
    `INSERT INTO projects (id, client_id, name, github_repo, created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL)`,
    input.id,
    input.client_id,
    input.name,
    input.github_repo ?? null,
    timestamp,
    timestamp,
  );
}

export async function listProjectsByClient(clientId: string): Promise<Project[]> {
  const db = await getDb();
  return db.getAllAsync<Project>(
    `SELECT id, client_id, name, github_repo, created_at, updated_at, deleted_at
     FROM projects
     WHERE client_id = ? AND deleted_at IS NULL
     ORDER BY name COLLATE NOCASE ASC`,
    clientId,
  );
}

export async function createTask(input: {
  id: string;
  project_id: string;
  name: string;
  github_branch?: string | null;
}): Promise<void> {
  const db = await getDb();
  const timestamp = nowIso();

  await db.runAsync(
    `INSERT INTO tasks (id, project_id, name, github_branch, created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL)`,
    input.id,
    input.project_id,
    input.name,
    input.github_branch ?? null,
    timestamp,
    timestamp,
  );
}

export async function listTasksByProject(projectId: string): Promise<Task[]> {
  const db = await getDb();
  return db.getAllAsync<Task>(
    `SELECT id, project_id, name, github_branch, created_at, updated_at, deleted_at
     FROM tasks
     WHERE project_id = ? AND deleted_at IS NULL
     ORDER BY name COLLATE NOCASE ASC`,
    projectId,
  );
}

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
     WHERE session_id = ? AND deleted_at IS NULL`,
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

export async function createInvoice(input: {
  id: string;
  client_id: string;
  total: number;
  status?: Invoice['status'];
  mercury_invoice_id?: string | null;
  payment_link?: string | null;
}): Promise<void> {
  const db = await getDb();
  const timestamp = nowIso();
  assertDbInvoiceTotal(input.total);

  await db.runAsync(
    `INSERT INTO invoices (id, client_id, total, status, mercury_invoice_id, payment_link, created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    input.id,
    input.client_id,
    input.total,
    input.status ?? 'draft',
    input.mercury_invoice_id ?? null,
    input.payment_link ?? null,
    timestamp,
    timestamp,
  );
}

export async function listInvoices(): Promise<InvoiceWithClient[]> {
  const db = await getDb();
  return db.getAllAsync<InvoiceWithClient>(
    `SELECT
       i.id,
       i.client_id,
       i.total,
       i.status,
       i.mercury_invoice_id,
       i.payment_link,
       i.created_at,
       i.updated_at,
       i.deleted_at,
       c.name AS client_name,
       c.email AS client_email,
       c.phone AS client_phone,
       c.hourly_rate AS client_hourly_rate
     FROM invoices i
     LEFT JOIN clients c ON c.id = i.client_id
     WHERE i.deleted_at IS NULL
     ORDER BY i.created_at DESC`,
  );
}

export async function listSessionsByInvoiceId(invoiceId: string): Promise<Session[]> {
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
       AND s.invoice_id = ?
     ORDER BY s.start_time ASC`,
    invoiceId,
  );
}

export async function assignSessionsToInvoice(sessionIds: string[], invoiceId: string): Promise<void> {
  if (sessionIds.length === 0) {
    return;
  }

  const db = await getDb();
  const placeholders = sessionIds.map(() => '?').join(',');

  await db.runAsync(
    `UPDATE sessions
       SET invoice_id = ?, updated_at = ?
     WHERE id IN (${placeholders})`,
    invoiceId,
    nowIso(),
    ...sessionIds,
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

export async function runCoreDbValidationScript(): Promise<CoreDbValidationReport> {
  await initializeDatabase();

  const testClientId = buildTestId('client');
  const timedSessionId = buildTestId('timed_session');
  const manualSessionId = buildTestId('manual_session');
  const invoiceId = buildTestId('invoice');

  const baseTimeMs = Date.now() - 5 * 60_000;
  const timedStart = new Date(baseTimeMs).toISOString();
  const timedEnd = new Date(baseTimeMs + 90_000).toISOString();
  const manualStart = new Date(baseTimeMs + 120_000).toISOString();
  const manualEnd = new Date(baseTimeMs + 180_000).toISOString();

  await createClient({
    id: testClientId,
    name: 'Validation Client',
    email: 'validation@time2pay.local',
    hourly_rate: 100,
  });

  await startSession({
    id: timedSessionId,
    client: 'Validation Client',
    start_time: timedStart,
    notes: 'timed session',
  });

  await stopSession({
    id: timedSessionId,
    end_time: timedEnd,
  });

  const pausedSessionId = buildTestId('paused_session');
  const pausedStart = new Date(baseTimeMs + 200_000).toISOString();
  const pausedEnd = new Date(baseTimeMs + 320_000).toISOString();
  const pausedBreakStart = new Date(baseTimeMs + 240_000).toISOString();
  const pausedBreakEnd = new Date(baseTimeMs + 280_000).toISOString();

  await startSession({
    id: pausedSessionId,
    client: 'Validation Client',
    start_time: pausedStart,
    notes: 'paused session',
  });

  await pauseSession({
    sessionId: pausedSessionId,
    start_time: pausedBreakStart,
  });

  await resumeSession({
    sessionId: pausedSessionId,
    end_time: pausedBreakEnd,
  });

  await stopSession({
    id: pausedSessionId,
    end_time: pausedEnd,
  });

  await addManualSession({
    id: manualSessionId,
    client: 'Validation Client',
    start_time: manualStart,
    end_time: manualEnd,
    notes: 'manual session',
  });

  await createInvoice({
    id: invoiceId,
    client_id: testClientId,
    total: 250,
    status: 'draft',
    payment_link: 'https://paypal.me/example/250',
  });

  await assignSessionsToInvoice([timedSessionId, manualSessionId], invoiceId);

  const db = await getDb();
  const linkedRows = await db.getAllAsync<Pick<Session, 'id' | 'invoice_id'>>(
    'SELECT id, invoice_id FROM sessions WHERE id IN (?, ?)',
    timedSessionId,
    manualSessionId,
  );

  const pausedDurationRow = await db.getFirstAsync<Pick<Session, 'duration'>>(
    'SELECT duration FROM sessions WHERE id = ?',
    pausedSessionId,
  );

  if ((pausedDurationRow?.duration ?? 0) !== 80) {
    throw new Error('Core DB validation failed: paused session duration mismatch');
  }

  const allLinked = linkedRows.length === 2 && linkedRows.every((row) => row.invoice_id === invoiceId);
  if (!allLinked) {
    throw new Error('Core DB validation failed: sessions were not linked to invoice as expected');
  }

  return {
    schemaVersion: await getCurrentSchemaVersion(),
    startedSessionId: timedSessionId,
    manualSessionId,
    invoiceId,
    linkedSessionCount: linkedRows.length,
  };
}
