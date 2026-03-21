import type { Client, PricingMode, Project, Task } from '@/database/types';
import { getDb, nowIso } from '@/database/local/shared/runtime';

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

export async function updateClientHourlyRate(input: {
  id: string;
  hourly_rate: number;
}): Promise<void> {
  if (!Number.isFinite(input.hourly_rate) || input.hourly_rate < 0) {
    throw new Error('Hourly rate must be a non-negative number.');
  }

  const db = await getDb();
  const result = await db.runAsync(
    `UPDATE clients
       SET hourly_rate = ?,
           updated_at = ?
     WHERE id = ?
       AND deleted_at IS NULL`,
    input.hourly_rate,
    nowIso(),
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
  pricing_mode?: PricingMode;
  total_project_fee?: number | null;
}): Promise<void> {
  const db = await getDb();
  const timestamp = nowIso();
  const normalizedPricingMode: PricingMode = input.pricing_mode ?? 'hourly';

  if (normalizedPricingMode !== 'hourly' && normalizedPricingMode !== 'milestone') {
    throw new Error('Invalid project pricing mode.');
  }

  const normalizedProjectFee =
    input.total_project_fee === undefined ? null : (input.total_project_fee ?? null);
  if (normalizedProjectFee !== null && (!Number.isFinite(normalizedProjectFee) || normalizedProjectFee < 0)) {
    throw new Error('Project fee must be a non-negative number.');
  }

  await db.runAsync(
    `INSERT INTO projects (
      id,
      client_id,
      name,
      github_repo,
      pricing_mode,
      total_project_fee,
      created_at,
      updated_at,
      deleted_at
    )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    input.id,
    input.client_id,
    input.name,
    input.github_repo ?? null,
    normalizedPricingMode,
    normalizedProjectFee,
    timestamp,
    timestamp,
  );
}

export async function listProjectsByClient(clientId: string): Promise<Project[]> {
  const db = await getDb();
  return db.getAllAsync<Project>(
    `SELECT id, client_id, name, github_repo, pricing_mode, total_project_fee, created_at, updated_at, deleted_at
     FROM projects
     WHERE client_id = ? AND deleted_at IS NULL
     ORDER BY name COLLATE NOCASE ASC`,
    clientId,
  );
}

export async function listProjects(): Promise<Project[]> {
  const db = await getDb();
  return db.getAllAsync<Project>(
    `SELECT id, client_id, name, github_repo, pricing_mode, total_project_fee, created_at, updated_at, deleted_at
     FROM projects
     WHERE deleted_at IS NULL
     ORDER BY name COLLATE NOCASE ASC`,
  );
}

export async function getProjectById(projectId: string): Promise<Project | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<Project>(
    `SELECT id, client_id, name, github_repo, pricing_mode, total_project_fee, created_at, updated_at, deleted_at
     FROM projects
     WHERE id = ? AND deleted_at IS NULL`,
    projectId,
  );
  return row ?? null;
}

export async function updateProjectPricing(input: {
  id: string;
  pricing_mode: PricingMode;
  total_project_fee: number | null;
}): Promise<void> {
  if (input.pricing_mode !== 'hourly' && input.pricing_mode !== 'milestone') {
    throw new Error('Invalid project pricing mode.');
  }

  if (
    input.total_project_fee !== null &&
    (!Number.isFinite(input.total_project_fee) || input.total_project_fee < 0)
  ) {
    throw new Error('Project fee must be a non-negative number.');
  }

  const db = await getDb();
  const result = await db.runAsync(
    `UPDATE projects
       SET pricing_mode = ?,
           total_project_fee = ?,
           updated_at = ?
     WHERE id = ?
       AND deleted_at IS NULL`,
    input.pricing_mode,
    input.total_project_fee,
    nowIso(),
    input.id,
  );

  if (result.changes === 0) {
    throw new Error('Project not found');
  }
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
