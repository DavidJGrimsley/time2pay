import {
  getCurrentSchemaVersion,
  getDb,
  initializeDatabase,
  type Client,
  type Invoice,
  type Project,
  type Session,
  type SessionBreak,
  type Task,
  type UserProfile,
} from '@/database/db';

const BACKUP_FORMAT = 'time2pay-backup';
const BACKUP_VERSION = 1;
const TIMER_LAST_SELECTION_KEY = 'time2pay.timer.last-selection';
const INVOICE_STATUSES = ['draft', 'sent', 'paid', 'overdue'] as const;

type BackupDataTables = {
  userProfile: UserProfile[];
  clients: Client[];
  projects: Project[];
  tasks: Task[];
  sessions: Session[];
  sessionBreaks: SessionBreak[];
  invoices: Invoice[];
};

export type TimerLastSelection = {
  clientId: string | null;
  projectId: string | null;
  taskId: string | null;
};

export type Time2PayBackupV1 = {
  format: typeof BACKUP_FORMAT;
  backupVersion: typeof BACKUP_VERSION;
  schemaVersion: number;
  createdAt: string;
  data: BackupDataTables;
  preferences: {
    timerLastSelection: TimerLastSelection | null;
  };
};

export type BackupRecordCounts = {
  userProfile: number;
  clients: number;
  projects: number;
  tasks: number;
  sessions: number;
  sessionBreaks: number;
  invoices: number;
};

export type RestoreBackupOptions = {
  replaceAll: true;
  createSafetyBackup: boolean;
};

export type RestoreReport = {
  counts: BackupRecordCounts;
  safetyBackupCreated: boolean;
  safetyBackupFilename: string | null;
  preferenceRestored: boolean;
};

type SqliteForeignKeyIssue = {
  table: string;
  rowid: number;
  parent: string;
  fkid: number;
};

function nowIso(): string {
  return new Date().toISOString();
}

function toFilenameTimestamp(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

function toBackupFilename(prefix: string): string {
  return `${prefix}-${toFilenameTimestamp(new Date())}.json`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getRequiredField(record: Record<string, unknown>, key: string, path: string): unknown {
  if (!Object.prototype.hasOwnProperty.call(record, key)) {
    throw new Error(`Missing required field: ${path}.${key}`);
  }
  return record[key];
}

function getOptionalField(record: Record<string, unknown>, key: string): unknown {
  if (!Object.prototype.hasOwnProperty.call(record, key)) {
    return undefined;
  }
  return record[key];
}

function readRecord(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`Expected object at ${path}`);
  }
  return value;
}

function readArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`Expected array at ${path}`);
  }
  return value;
}

function readString(value: unknown, path: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Expected string at ${path}`);
  }
  return value;
}

function readNullableString(value: unknown, path: string): string | null {
  if (value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new Error(`Expected string|null at ${path}`);
  }
  return value;
}

function readNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Expected finite number at ${path}`);
  }
  return value;
}

function readNullableNumber(value: unknown, path: string): number | null {
  if (value === null) {
    return null;
  }
  return readNumber(value, path);
}

function readInteger(value: unknown, path: string): number {
  const numberValue = readNumber(value, path);
  if (!Number.isInteger(numberValue)) {
    throw new Error(`Expected integer at ${path}`);
  }
  return numberValue;
}

function readNullableIsoTimestamp(value: unknown, path: string): string | null {
  const stringValue = readNullableString(value, path);
  if (stringValue === null) {
    return null;
  }
  if (Number.isNaN(Date.parse(stringValue))) {
    throw new Error(`Expected ISO timestamp at ${path}`);
  }
  return stringValue;
}

function readIsoTimestamp(value: unknown, path: string): string {
  const stringValue = readString(value, path);
  if (Number.isNaN(Date.parse(stringValue))) {
    throw new Error(`Expected ISO timestamp at ${path}`);
  }
  return stringValue;
}

function parseTimerLastSelection(value: unknown, path: string): TimerLastSelection | null {
  if (value === null || value === undefined) {
    return null;
  }

  const record = readRecord(value, path);
  const clientId = readNullableString(
    getOptionalField(record, 'clientId') ?? null,
    `${path}.clientId`,
  );
  const projectId = readNullableString(
    getOptionalField(record, 'projectId') ?? null,
    `${path}.projectId`,
  );
  const taskId = readNullableString(getOptionalField(record, 'taskId') ?? null, `${path}.taskId`);

  if (clientId === null && projectId === null && taskId === null) {
    return null;
  }

  return {
    clientId,
    projectId,
    taskId,
  };
}

function parseUserProfile(value: unknown, path: string): UserProfile {
  const record = readRecord(value, path);
  return {
    id: readString(getRequiredField(record, 'id', path), `${path}.id`),
    company_name: readNullableString(
      getRequiredField(record, 'company_name', path),
      `${path}.company_name`,
    ),
    logo_url: readNullableString(getRequiredField(record, 'logo_url', path), `${path}.logo_url`),
    full_name: readNullableString(getRequiredField(record, 'full_name', path), `${path}.full_name`),
    phone: readNullableString(getRequiredField(record, 'phone', path), `${path}.phone`),
    email: readNullableString(getRequiredField(record, 'email', path), `${path}.email`),
    created_at: readIsoTimestamp(getRequiredField(record, 'created_at', path), `${path}.created_at`),
    updated_at: readIsoTimestamp(getRequiredField(record, 'updated_at', path), `${path}.updated_at`),
  };
}

function parseClient(value: unknown, path: string): Client {
  const record = readRecord(value, path);
  return {
    id: readString(getRequiredField(record, 'id', path), `${path}.id`),
    name: readString(getRequiredField(record, 'name', path), `${path}.name`),
    email: readNullableString(getRequiredField(record, 'email', path), `${path}.email`),
    phone: readNullableString(getRequiredField(record, 'phone', path), `${path}.phone`),
    hourly_rate: readNumber(getRequiredField(record, 'hourly_rate', path), `${path}.hourly_rate`),
    github_org: readNullableString(
      getRequiredField(record, 'github_org', path),
      `${path}.github_org`,
    ),
    created_at: readIsoTimestamp(getRequiredField(record, 'created_at', path), `${path}.created_at`),
    updated_at: readIsoTimestamp(getRequiredField(record, 'updated_at', path), `${path}.updated_at`),
    deleted_at: readNullableIsoTimestamp(
      getRequiredField(record, 'deleted_at', path),
      `${path}.deleted_at`,
    ),
  };
}

function parseProject(value: unknown, path: string): Project {
  const record = readRecord(value, path);
  return {
    id: readString(getRequiredField(record, 'id', path), `${path}.id`),
    client_id: readString(getRequiredField(record, 'client_id', path), `${path}.client_id`),
    name: readString(getRequiredField(record, 'name', path), `${path}.name`),
    github_repo: readNullableString(
      getRequiredField(record, 'github_repo', path),
      `${path}.github_repo`,
    ),
    created_at: readIsoTimestamp(getRequiredField(record, 'created_at', path), `${path}.created_at`),
    updated_at: readIsoTimestamp(getRequiredField(record, 'updated_at', path), `${path}.updated_at`),
    deleted_at: readNullableIsoTimestamp(
      getRequiredField(record, 'deleted_at', path),
      `${path}.deleted_at`,
    ),
  };
}

function parseTask(value: unknown, path: string): Task {
  const record = readRecord(value, path);
  return {
    id: readString(getRequiredField(record, 'id', path), `${path}.id`),
    project_id: readString(getRequiredField(record, 'project_id', path), `${path}.project_id`),
    name: readString(getRequiredField(record, 'name', path), `${path}.name`),
    github_branch: readNullableString(
      getRequiredField(record, 'github_branch', path),
      `${path}.github_branch`,
    ),
    created_at: readIsoTimestamp(getRequiredField(record, 'created_at', path), `${path}.created_at`),
    updated_at: readIsoTimestamp(getRequiredField(record, 'updated_at', path), `${path}.updated_at`),
    deleted_at: readNullableIsoTimestamp(
      getRequiredField(record, 'deleted_at', path),
      `${path}.deleted_at`,
    ),
  };
}

function parseSession(value: unknown, path: string): Session {
  const record = readRecord(value, path);
  const duration = readNullableNumber(getRequiredField(record, 'duration', path), `${path}.duration`);
  if (duration !== null && (!Number.isInteger(duration) || duration < 0)) {
    throw new Error(`Expected non-negative integer|null at ${path}.duration`);
  }

  return {
    id: readString(getRequiredField(record, 'id', path), `${path}.id`),
    client: readString(getRequiredField(record, 'client', path), `${path}.client`),
    client_id: readNullableString(getRequiredField(record, 'client_id', path), `${path}.client_id`),
    project_id: readNullableString(
      getRequiredField(record, 'project_id', path),
      `${path}.project_id`,
    ),
    task_id: readNullableString(getRequiredField(record, 'task_id', path), `${path}.task_id`),
    start_time: readIsoTimestamp(getRequiredField(record, 'start_time', path), `${path}.start_time`),
    end_time: readNullableIsoTimestamp(getRequiredField(record, 'end_time', path), `${path}.end_time`),
    duration,
    notes: readNullableString(getRequiredField(record, 'notes', path), `${path}.notes`),
    commit_sha: readNullableString(getRequiredField(record, 'commit_sha', path), `${path}.commit_sha`),
    invoice_id: readNullableString(
      getRequiredField(record, 'invoice_id', path),
      `${path}.invoice_id`,
    ),
    created_at: readIsoTimestamp(getRequiredField(record, 'created_at', path), `${path}.created_at`),
    updated_at: readIsoTimestamp(getRequiredField(record, 'updated_at', path), `${path}.updated_at`),
    deleted_at: readNullableIsoTimestamp(
      getRequiredField(record, 'deleted_at', path),
      `${path}.deleted_at`,
    ),
  };
}

function parseSessionBreak(value: unknown, path: string): SessionBreak {
  const record = readRecord(value, path);
  return {
    id: readString(getRequiredField(record, 'id', path), `${path}.id`),
    session_id: readString(getRequiredField(record, 'session_id', path), `${path}.session_id`),
    start_time: readIsoTimestamp(getRequiredField(record, 'start_time', path), `${path}.start_time`),
    end_time: readNullableIsoTimestamp(getRequiredField(record, 'end_time', path), `${path}.end_time`),
    created_at: readIsoTimestamp(getRequiredField(record, 'created_at', path), `${path}.created_at`),
    updated_at: readIsoTimestamp(getRequiredField(record, 'updated_at', path), `${path}.updated_at`),
    deleted_at: readNullableIsoTimestamp(
      getRequiredField(record, 'deleted_at', path),
      `${path}.deleted_at`,
    ),
  };
}

function parseInvoice(value: unknown, path: string): Invoice {
  const record = readRecord(value, path);
  const status = readString(getRequiredField(record, 'status', path), `${path}.status`);
  if (!INVOICE_STATUSES.includes(status as Invoice['status'])) {
    throw new Error(`Invalid invoice status at ${path}.status`);
  }

  return {
    id: readString(getRequiredField(record, 'id', path), `${path}.id`),
    client_id: readString(getRequiredField(record, 'client_id', path), `${path}.client_id`),
    total: readNumber(getRequiredField(record, 'total', path), `${path}.total`),
    status: status as Invoice['status'],
    mercury_invoice_id: readNullableString(
      getRequiredField(record, 'mercury_invoice_id', path),
      `${path}.mercury_invoice_id`,
    ),
    payment_link: readNullableString(
      getRequiredField(record, 'payment_link', path),
      `${path}.payment_link`,
    ),
    created_at: readIsoTimestamp(getRequiredField(record, 'created_at', path), `${path}.created_at`),
    updated_at: readIsoTimestamp(getRequiredField(record, 'updated_at', path), `${path}.updated_at`),
    deleted_at: readNullableIsoTimestamp(
      getRequiredField(record, 'deleted_at', path),
      `${path}.deleted_at`,
    ),
  };
}

function parseRows<T>(
  value: unknown,
  path: string,
  parser: (row: unknown, rowPath: string) => T,
): T[] {
  const rows = readArray(value, path);
  return rows.map((row, index) => parser(row, `${path}[${index}]`));
}

function parseBackupObject(value: unknown): Time2PayBackupV1 {
  const root = readRecord(value, 'backup');
  const format = readString(getRequiredField(root, 'format', 'backup'), 'backup.format');
  if (format !== BACKUP_FORMAT) {
    throw new Error(
      `Unsupported backup format "${format}". Expected "${BACKUP_FORMAT}".`,
    );
  }

  const backupVersion = readInteger(
    getRequiredField(root, 'backupVersion', 'backup'),
    'backup.backupVersion',
  );
  if (backupVersion > BACKUP_VERSION) {
    throw new Error(
      `Backup version ${backupVersion} is newer than this app supports (${BACKUP_VERSION}).`,
    );
  }
  if (backupVersion !== BACKUP_VERSION) {
    throw new Error(`Unsupported backup version ${backupVersion}. Expected ${BACKUP_VERSION}.`);
  }

  const schemaVersion = readInteger(
    getRequiredField(root, 'schemaVersion', 'backup'),
    'backup.schemaVersion',
  );
  if (schemaVersion < 1) {
    throw new Error('Invalid schemaVersion in backup payload.');
  }

  const createdAt = readIsoTimestamp(
    getRequiredField(root, 'createdAt', 'backup'),
    'backup.createdAt',
  );

  const dataRecord = readRecord(getRequiredField(root, 'data', 'backup'), 'backup.data');
  const preferencesRecord = readRecord(
    getOptionalField(root, 'preferences') ?? {},
    'backup.preferences',
  );

  return {
    format: BACKUP_FORMAT,
    backupVersion: BACKUP_VERSION,
    schemaVersion,
    createdAt,
    data: {
      userProfile: parseRows(
        getRequiredField(dataRecord, 'userProfile', 'backup.data'),
        'backup.data.userProfile',
        parseUserProfile,
      ),
      clients: parseRows(
        getRequiredField(dataRecord, 'clients', 'backup.data'),
        'backup.data.clients',
        parseClient,
      ),
      projects: parseRows(
        getRequiredField(dataRecord, 'projects', 'backup.data'),
        'backup.data.projects',
        parseProject,
      ),
      tasks: parseRows(
        getRequiredField(dataRecord, 'tasks', 'backup.data'),
        'backup.data.tasks',
        parseTask,
      ),
      sessions: parseRows(
        getRequiredField(dataRecord, 'sessions', 'backup.data'),
        'backup.data.sessions',
        parseSession,
      ),
      sessionBreaks: parseRows(
        getRequiredField(dataRecord, 'sessionBreaks', 'backup.data'),
        'backup.data.sessionBreaks',
        parseSessionBreak,
      ),
      invoices: parseRows(
        getRequiredField(dataRecord, 'invoices', 'backup.data'),
        'backup.data.invoices',
        parseInvoice,
      ),
    },
    preferences: {
      timerLastSelection: parseTimerLastSelection(
        getOptionalField(preferencesRecord, 'timerLastSelection') ?? null,
        'backup.preferences.timerLastSelection',
      ),
    },
  };
}

function getBackupRecordCounts(data: BackupDataTables): BackupRecordCounts {
  return {
    userProfile: data.userProfile.length,
    clients: data.clients.length,
    projects: data.projects.length,
    tasks: data.tasks.length,
    sessions: data.sessions.length,
    sessionBreaks: data.sessionBreaks.length,
    invoices: data.invoices.length,
  };
}

function readTimerSelectionFromLocalStorage(): TimerLastSelection | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }

  try {
    const raw = localStorage.getItem(TIMER_LAST_SELECTION_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;
    return parseTimerLastSelection(parsed, 'localStorage.timerLastSelection');
  } catch {
    return null;
  }
}

function writeTimerSelectionToLocalStorage(selection: TimerLastSelection | null): boolean {
  if (typeof localStorage === 'undefined') {
    return false;
  }

  if (!selection) {
    localStorage.removeItem(TIMER_LAST_SELECTION_KEY);
    return true;
  }

  localStorage.setItem(TIMER_LAST_SELECTION_KEY, JSON.stringify(selection));
  return true;
}

function sanitizeImportedTimerSelection(
  selection: TimerLastSelection | null,
  data: BackupDataTables,
): TimerLastSelection | null {
  if (!selection) {
    return null;
  }

  const activeClientIds = new Set(
    data.clients.filter((client) => client.deleted_at === null).map((client) => client.id),
  );

  const activeProjects = data.projects.filter((project) => project.deleted_at === null);
  const projectToClient = new Map(activeProjects.map((project) => [project.id, project.client_id]));

  const activeTasks = data.tasks.filter((task) => task.deleted_at === null);
  const taskToProject = new Map(activeTasks.map((task) => [task.id, task.project_id]));

  let clientId = selection.clientId;
  let projectId = selection.projectId;
  let taskId = selection.taskId;

  if (clientId && !activeClientIds.has(clientId)) {
    clientId = null;
  }

  if (projectId && !projectToClient.has(projectId)) {
    projectId = null;
  }

  if (taskId && !taskToProject.has(taskId)) {
    taskId = null;
  }

  if (!clientId) {
    projectId = null;
    taskId = null;
  } else if (projectId) {
    const projectClientId = projectToClient.get(projectId) ?? null;
    if (projectClientId !== clientId) {
      projectId = null;
      taskId = null;
    }
  }

  if (projectId && taskId) {
    const taskProjectId = taskToProject.get(taskId) ?? null;
    if (taskProjectId !== projectId) {
      taskId = null;
    }
  } else if (!projectId) {
    taskId = null;
  }

  if (!clientId && !projectId && !taskId) {
    return null;
  }

  return { clientId, projectId, taskId };
}

async function clearAllAppData(): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM session_breaks');
  await db.runAsync('DELETE FROM sessions');
  await db.runAsync('DELETE FROM tasks');
  await db.runAsync('DELETE FROM projects');
  await db.runAsync('DELETE FROM invoices');
  await db.runAsync('DELETE FROM clients');
  await db.runAsync('DELETE FROM user_profile');
}

async function insertBackupData(data: BackupDataTables): Promise<void> {
  const db = await getDb();

  for (const profile of data.userProfile) {
    await db.runAsync(
      `INSERT INTO user_profile (
        id,
        company_name,
        logo_url,
        full_name,
        phone,
        email,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      profile.id,
      profile.company_name,
      profile.logo_url,
      profile.full_name,
      profile.phone,
      profile.email,
      profile.created_at,
      profile.updated_at,
    );
  }

  for (const client of data.clients) {
    await db.runAsync(
      `INSERT INTO clients (
        id,
        name,
        email,
        phone,
        hourly_rate,
        github_org,
        created_at,
        updated_at,
        deleted_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      client.id,
      client.name,
      client.email,
      client.phone,
      client.hourly_rate,
      client.github_org,
      client.created_at,
      client.updated_at,
      client.deleted_at,
    );
  }

  for (const project of data.projects) {
    await db.runAsync(
      `INSERT INTO projects (
        id,
        client_id,
        name,
        github_repo,
        created_at,
        updated_at,
        deleted_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      project.id,
      project.client_id,
      project.name,
      project.github_repo,
      project.created_at,
      project.updated_at,
      project.deleted_at,
    );
  }

  for (const task of data.tasks) {
    await db.runAsync(
      `INSERT INTO tasks (
        id,
        project_id,
        name,
        github_branch,
        created_at,
        updated_at,
        deleted_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      task.id,
      task.project_id,
      task.name,
      task.github_branch,
      task.created_at,
      task.updated_at,
      task.deleted_at,
    );
  }

  for (const invoice of data.invoices) {
    await db.runAsync(
      `INSERT INTO invoices (
        id,
        client_id,
        total,
        status,
        mercury_invoice_id,
        payment_link,
        created_at,
        updated_at,
        deleted_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      invoice.id,
      invoice.client_id,
      invoice.total,
      invoice.status,
      invoice.mercury_invoice_id,
      invoice.payment_link,
      invoice.created_at,
      invoice.updated_at,
      invoice.deleted_at,
    );
  }

  for (const session of data.sessions) {
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
        commit_sha,
        invoice_id,
        created_at,
        updated_at,
        deleted_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      session.id,
      session.client,
      session.client_id,
      session.project_id,
      session.task_id,
      session.start_time,
      session.end_time,
      session.duration,
      session.notes,
      session.commit_sha,
      session.invoice_id,
      session.created_at,
      session.updated_at,
      session.deleted_at,
    );
  }

  for (const sessionBreak of data.sessionBreaks) {
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
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      sessionBreak.id,
      sessionBreak.session_id,
      sessionBreak.start_time,
      sessionBreak.end_time,
      sessionBreak.created_at,
      sessionBreak.updated_at,
      sessionBreak.deleted_at,
    );
  }
}

async function assertNoForeignKeyViolations(): Promise<void> {
  const db = await getDb();
  const issues = await db.getAllAsync<SqliteForeignKeyIssue>('PRAGMA foreign_key_check;');
  if (issues.length === 0) {
    return;
  }

  const firstIssue = issues[0];
  throw new Error(
    `Import failed foreign-key validation at table "${firstIssue.table}" (rowid ${firstIssue.rowid}).`,
  );
}

function assertWebFileApisAvailable(): void {
  if (process.env.EXPO_OS !== 'web') {
    throw new Error('Backup download is only supported in web/PWA mode for now.');
  }
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('Backup download is only available in a browser environment.');
  }
}

function triggerJsonDownload(filename: string, json: string): void {
  assertWebFileApisAvailable();

  const blob = new Blob([json], { type: 'application/json' });
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(objectUrl);
}

export function formatBackupSummary(snapshot: Time2PayBackupV1): string {
  const counts = getBackupRecordCounts(snapshot.data);
  return [
    `${counts.userProfile} profile`,
    `${counts.clients} clients`,
    `${counts.projects} projects`,
    `${counts.tasks} tasks`,
    `${counts.sessions} sessions`,
    `${counts.sessionBreaks} breaks`,
    `${counts.invoices} invoices`,
  ].join(', ');
}

export async function createBackupSnapshot(): Promise<Time2PayBackupV1> {
  await initializeDatabase();
  const db = await getDb();

  const [
    schemaVersion,
    userProfile,
    clients,
    projects,
    tasks,
    sessions,
    sessionBreaks,
    invoices,
  ] = await Promise.all([
    getCurrentSchemaVersion(),
    db.getAllAsync<UserProfile>(
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
      ORDER BY id ASC`,
    ),
    db.getAllAsync<Client>(
      `SELECT
        id,
        name,
        email,
        phone,
        hourly_rate,
        github_org,
        created_at,
        updated_at,
        deleted_at
      FROM clients
      ORDER BY created_at ASC`,
    ),
    db.getAllAsync<Project>(
      `SELECT
        id,
        client_id,
        name,
        github_repo,
        created_at,
        updated_at,
        deleted_at
      FROM projects
      ORDER BY created_at ASC`,
    ),
    db.getAllAsync<Task>(
      `SELECT
        id,
        project_id,
        name,
        github_branch,
        created_at,
        updated_at,
        deleted_at
      FROM tasks
      ORDER BY created_at ASC`,
    ),
    db.getAllAsync<Session>(
      `SELECT
        id,
        client,
        client_id,
        project_id,
        task_id,
        start_time,
        end_time,
        duration,
        notes,
        commit_sha,
        invoice_id,
        created_at,
        updated_at,
        deleted_at
      FROM sessions
      ORDER BY created_at ASC`,
    ),
    db.getAllAsync<SessionBreak>(
      `SELECT
        id,
        session_id,
        start_time,
        end_time,
        created_at,
        updated_at,
        deleted_at
      FROM session_breaks
      ORDER BY created_at ASC`,
    ),
    db.getAllAsync<Invoice>(
      `SELECT
        id,
        client_id,
        total,
        status,
        mercury_invoice_id,
        payment_link,
        created_at,
        updated_at,
        deleted_at
      FROM invoices
      ORDER BY created_at ASC`,
    ),
  ]);

  return {
    format: BACKUP_FORMAT,
    backupVersion: BACKUP_VERSION,
    schemaVersion,
    createdAt: nowIso(),
    data: {
      userProfile,
      clients,
      projects,
      tasks,
      sessions,
      sessionBreaks,
      invoices,
    },
    preferences: {
      timerLastSelection: readTimerSelectionFromLocalStorage(),
    },
  };
}

export async function downloadBackup(
  snapshot: Time2PayBackupV1,
  options?: {
    filename?: string;
  },
): Promise<{ filename: string }> {
  const validatedSnapshot = parseBackupObject(snapshot);
  const filename = options?.filename ?? toBackupFilename('time2pay-backup');
  const json = `${JSON.stringify(validatedSnapshot, null, 2)}\n`;
  triggerJsonDownload(filename, json);
  return { filename };
}

export function parseAndValidateBackup(jsonText: string): Time2PayBackupV1 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText) as unknown;
  } catch {
    throw new Error('Backup file is not valid JSON.');
  }

  return parseBackupObject(parsed);
}

export async function restoreBackup(
  snapshot: Time2PayBackupV1,
  options: RestoreBackupOptions,
): Promise<RestoreReport> {
  if (!options.replaceAll) {
    throw new Error('Only replace-all import mode is supported.');
  }

  const validatedSnapshot = parseBackupObject(snapshot);
  await initializeDatabase();
  const db = await getDb();

  let safetyBackupFilename: string | null = null;
  if (options.createSafetyBackup) {
    const rollbackSnapshot = await createBackupSnapshot();
    safetyBackupFilename = toBackupFilename('time2pay-rollback');
    await downloadBackup(rollbackSnapshot, { filename: safetyBackupFilename });
  }

  await db.execAsync('BEGIN IMMEDIATE;');
  try {
    await clearAllAppData();
    await insertBackupData(validatedSnapshot.data);
    await assertNoForeignKeyViolations();
    await db.execAsync('COMMIT;');
  } catch (error) {
    await db.execAsync('ROLLBACK;');
    throw error;
  }

  const sanitizedSelection = sanitizeImportedTimerSelection(
    validatedSnapshot.preferences.timerLastSelection,
    validatedSnapshot.data,
  );
  const preferenceRestored = writeTimerSelectionToLocalStorage(sanitizedSelection);

  return {
    counts: getBackupRecordCounts(validatedSnapshot.data),
    safetyBackupCreated: options.createSafetyBackup,
    safetyBackupFilename,
    preferenceRestored,
  };
}
