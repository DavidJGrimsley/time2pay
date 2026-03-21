import * as SQLite from 'expo-sqlite';

const DB_NAME = 'time2pay.db';
const SCHEMA_VERSION = 10;
export const USER_PROFILE_ID = 'me';

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
  {
    version: 8,
    upSql: `
      ALTER TABLE user_profile ADD COLUMN github_pat TEXT;
    `,
  },
  {
    version: 9,
    upSql: `
      ALTER TABLE projects ADD COLUMN pricing_mode TEXT NOT NULL DEFAULT 'hourly';
      ALTER TABLE projects ADD COLUMN total_project_fee REAL;

      ALTER TABLE invoices ADD COLUMN invoice_type TEXT NOT NULL DEFAULT 'hourly';
      ALTER TABLE invoices ADD COLUMN source_project_id TEXT;
      ALTER TABLE invoices ADD COLUMN source_project_name TEXT;
      ALTER TABLE invoices ADD COLUMN source_milestone_id TEXT;
      ALTER TABLE invoices ADD COLUMN source_milestone_title TEXT;
      ALTER TABLE invoices ADD COLUMN source_milestone_amount_type TEXT;
      ALTER TABLE invoices ADD COLUMN source_milestone_amount_value REAL;
      ALTER TABLE invoices ADD COLUMN source_milestone_completion_mode TEXT;
      ALTER TABLE invoices ADD COLUMN source_milestone_completed_at TEXT;
      ALTER TABLE invoices ADD COLUMN source_session_link_mode TEXT;

      CREATE TABLE IF NOT EXISTS project_milestones (
        id TEXT PRIMARY KEY NOT NULL,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL,
        amount_type TEXT NOT NULL,
        amount_value REAL NOT NULL,
        completion_mode TEXT NOT NULL,
        due_note TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_completed INTEGER NOT NULL DEFAULT 0,
        completed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        FOREIGN KEY (project_id) REFERENCES projects(id)
      );

      CREATE TABLE IF NOT EXISTS milestone_checklist_items (
        id TEXT PRIMARY KEY NOT NULL,
        milestone_id TEXT NOT NULL,
        label TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_completed INTEGER NOT NULL DEFAULT 0,
        completed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        FOREIGN KEY (milestone_id) REFERENCES project_milestones(id)
      );

      CREATE TABLE IF NOT EXISTS invoice_session_links (
        id TEXT PRIMARY KEY NOT NULL,
        invoice_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        link_mode TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (invoice_id, session_id),
        FOREIGN KEY (invoice_id) REFERENCES invoices(id),
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      );

      CREATE INDEX IF NOT EXISTS idx_projects_pricing_mode ON projects(pricing_mode);
      CREATE INDEX IF NOT EXISTS idx_project_milestones_project_id ON project_milestones(project_id);
      CREATE INDEX IF NOT EXISTS idx_project_milestones_sort_order ON project_milestones(sort_order);
      CREATE INDEX IF NOT EXISTS idx_milestone_checklist_items_milestone_id ON milestone_checklist_items(milestone_id);
      CREATE INDEX IF NOT EXISTS idx_invoice_session_links_invoice_id ON invoice_session_links(invoice_id);
      CREATE INDEX IF NOT EXISTS idx_invoice_session_links_session_id ON invoice_session_links(session_id);
    `,
  },
  {
    version: 10,
    upSql: `
      ALTER TABLE invoices ADD COLUMN source_session_hourly_rate REAL;
    `,
  },
];

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function nowIso(): string {
  return new Date().toISOString();
}

export function createDbId(prefix: string): string {
  const randomUuid =
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${randomUuid}`;
}

export function buildTestId(prefix: string): string {
  return createDbId(prefix);
}

export function parseDbIsoTimestamp(input: string, fieldName: string): Date {
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid ${fieldName}: expected ISO-8601 timestamp`);
  }
  return parsed;
}

export function ensureNonNegativeDbDurationMs(start: string, end: string): number {
  const startDate = parseDbIsoTimestamp(start, 'start_time');
  const endDate = parseDbIsoTimestamp(end, 'end_time');
  const durationMs = endDate.getTime() - startDate.getTime();

  if (durationMs < 0) {
    throw new Error('Invalid session time range: end_time must be after start_time');
  }

  return durationMs;
}

export function dbDurationMsToSeconds(durationMs: number): number {
  return Math.round(durationMs / 1000);
}

export function computeBreakDurationMs(input: {
  sessionStartIso: string;
  sessionEndIso: string;
  breaks: Pick<{ start_time: string; end_time: string | null }, 'start_time' | 'end_time'>[];
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

export function assertDbInvoiceTotal(total: number): void {
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

export async function ensureUserProfileRow(db: SQLite.SQLiteDatabase): Promise<void> {
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
