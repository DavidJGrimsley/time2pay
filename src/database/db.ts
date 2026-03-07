import * as SQLite from 'expo-sqlite';

export type Session = {
  id: string;
  client: string;
  start_time: string;
  end_time: string | null;
  duration: number | null;
  notes: string | null;
  invoice_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type Client = {
  id: string;
  name: string;
  email: string | null;
  hourly_rate: number;
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

export type CoreDbValidationReport = {
  schemaVersion: number;
  startedSessionId: string;
  manualSessionId: string;
  invoiceId: string;
  linkedSessionCount: number;
};

const DB_NAME = 'time2pay.db';
const SCHEMA_VERSION = 2;

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
];

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function nowIso(): string {
  return new Date().toISOString();
}

function buildTestId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function parseIsoTimestamp(input: string, fieldName: string): Date {
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid ${fieldName}: expected ISO-8601 timestamp`);
  }
  return parsed;
}

function ensureNonNegativeDurationMs(start: string, end: string): number {
  const startDate = parseIsoTimestamp(start, 'start_time');
  const endDate = parseIsoTimestamp(end, 'end_time');
  const durationMs = endDate.getTime() - startDate.getTime();

  if (durationMs < 0) {
    throw new Error('Invalid session time range: end_time must be after start_time');
  }

  return durationMs;
}

function durationMsToSeconds(durationMs: number): number {
  return Math.round(durationMs / 1000);
}

function assertInvoiceTotal(total: number): void {
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
}

export async function getCurrentSchemaVersion(): Promise<number> {
  const db = await getDb();
  return getUserVersion(db);
}

export async function createClient(input: {
  id: string;
  name: string;
  email?: string | null;
  hourly_rate?: number;
}): Promise<void> {
  const db = await getDb();
  const timestamp = nowIso();

  await db.runAsync(
    `INSERT INTO clients (id, name, email, hourly_rate, created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    input.id,
    input.name,
    input.email ?? null,
    input.hourly_rate ?? 0,
    timestamp,
    timestamp,
    null,
  );
}

export async function startSession(input: {
  id: string;
  client: string;
  start_time?: string;
  notes?: string | null;
}): Promise<void> {
  const db = await getDb();
  const timestamp = nowIso();
  const startedAt = input.start_time ?? timestamp;
  parseIsoTimestamp(startedAt, 'start_time');

  await db.runAsync(
    `INSERT INTO sessions (id, client, start_time, end_time, duration, notes, invoice_id, created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, NULL, NULL, ?, NULL, ?, ?, NULL)`,
    input.id,
    input.client,
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

  const row = await db.getFirstAsync<Pick<Session, 'start_time' | 'end_time'>>(
    'SELECT start_time, end_time FROM sessions WHERE id = ?',
    input.id,
  );

  if (!row) {
    throw new Error(`Session ${input.id} not found`);
  }

  if (row.end_time) {
    throw new Error(`Session ${input.id} is already stopped`);
  }

  const durationSeconds = durationMsToSeconds(ensureNonNegativeDurationMs(row.start_time, endedAt));

  const result = await db.runAsync(
    `UPDATE sessions
       SET end_time = ?, duration = ?, updated_at = ?
     WHERE id = ? AND end_time IS NULL`,
    endedAt,
    durationSeconds,
    nowIso(),
    input.id,
  );

  if (result.changes === 0) {
    throw new Error(`Session ${input.id} is already stopped`);
  }
}

export async function addManualSession(input: {
  id: string;
  client: string;
  start_time: string;
  end_time: string;
  notes?: string | null;
}): Promise<void> {
  const db = await getDb();
  const timestamp = nowIso();
  const durationSeconds = durationMsToSeconds(
    ensureNonNegativeDurationMs(input.start_time, input.end_time),
  );

  await db.runAsync(
    `INSERT INTO sessions (id, client, start_time, end_time, duration, notes, invoice_id, created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL)`,
    input.id,
    input.client,
    input.start_time,
    input.end_time,
    durationSeconds,
    input.notes ?? null,
    timestamp,
    timestamp,
  );
}

export async function listSessions(): Promise<Session[]> {
  const db = await getDb();
  return db.getAllAsync<Session>(
    `SELECT id, client, start_time, end_time, duration, notes, invoice_id, created_at, updated_at, deleted_at
     FROM sessions
     ORDER BY start_time DESC`,
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
  assertInvoiceTotal(input.total);

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
