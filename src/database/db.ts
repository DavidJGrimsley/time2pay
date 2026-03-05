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
};

export type Client = {
  id: string;
  name: string;
  email: string | null;
  hourly_rate: number;
  created_at: string;
  updated_at: string;
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
};

const DB_NAME = 'time2pay.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function nowIso(): string {
  return new Date().toISOString();
}

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME);
  }
  return dbPromise;
}

export async function initializeDatabase(): Promise<void> {
  const db = await getDb();

  await db.execAsync(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;

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
  `);
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
    `INSERT INTO clients (id, name, email, hourly_rate, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    input.id,
    input.name,
    input.email ?? null,
    input.hourly_rate ?? 0,
    timestamp,
    timestamp,
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

  await db.runAsync(
    `INSERT INTO sessions (id, client, start_time, end_time, duration, notes, invoice_id, created_at, updated_at)
     VALUES (?, ?, ?, NULL, NULL, ?, NULL, ?, ?)`,
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

  const row = await db.getFirstAsync<Pick<Session, 'start_time'>>(
    'SELECT start_time FROM sessions WHERE id = ?',
    input.id,
  );

  if (!row) {
    throw new Error(`Session ${input.id} not found`);
  }

  const durationSeconds = Math.max(
    0,
    Math.round((new Date(endedAt).getTime() - new Date(row.start_time).getTime()) / 1000),
  );

  await db.runAsync(
    `UPDATE sessions
       SET end_time = ?, duration = ?, updated_at = ?
     WHERE id = ?`,
    endedAt,
    durationSeconds,
    nowIso(),
    input.id,
  );
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
  const durationSeconds = Math.max(
    0,
    Math.round((new Date(input.end_time).getTime() - new Date(input.start_time).getTime()) / 1000),
  );

  await db.runAsync(
    `INSERT INTO sessions (id, client, start_time, end_time, duration, notes, invoice_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
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
    `SELECT id, client, start_time, end_time, duration, notes, invoice_id, created_at, updated_at
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

  await db.runAsync(
    `INSERT INTO invoices (id, client_id, total, status, mercury_invoice_id, payment_link, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
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
