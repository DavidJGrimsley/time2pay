import type {
  MilestoneAmountType,
  MilestoneChecklistItem,
  MilestoneCompletionMode,
  ProjectMilestone,
} from '@/database/types';
import { getDb, nowIso } from '@/database/local/shared/runtime';

export async function createProjectMilestone(input: {
  id: string;
  project_id: string;
  title: string;
  amount_type: MilestoneAmountType;
  amount_value: number;
  completion_mode: MilestoneCompletionMode;
  due_note?: string | null;
  sort_order: number;
}): Promise<void> {
  if (input.amount_type !== 'percent' && input.amount_type !== 'fixed') {
    throw new Error('Invalid milestone amount type.');
  }
  if (input.completion_mode !== 'toggle' && input.completion_mode !== 'checklist') {
    throw new Error('Invalid milestone completion mode.');
  }

  const numericAmount = Number(input.amount_value);
  if (!Number.isFinite(numericAmount) || numericAmount < 0) {
    throw new Error('Milestone amount must be a non-negative number.');
  }

  const db = await getDb();
  const timestamp = nowIso();
  const normalizedSortOrder = Number.isFinite(input.sort_order) ? Math.trunc(input.sort_order) : 0;

  await db.runAsync(
    `INSERT INTO project_milestones (
      id,
      project_id,
      title,
      amount_type,
      amount_value,
      completion_mode,
      due_note,
      sort_order,
      is_completed,
      completed_at,
      created_at,
      updated_at,
      deleted_at
    )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?, NULL)`,
    input.id,
    input.project_id,
    input.title,
    input.amount_type,
    numericAmount,
    input.completion_mode,
    input.due_note ?? null,
    normalizedSortOrder,
    timestamp,
    timestamp,
  );
}

export async function listProjectMilestones(projectId: string): Promise<ProjectMilestone[]> {
  const db = await getDb();
  return db.getAllAsync<ProjectMilestone>(
    `SELECT
       id,
       project_id,
       title,
       amount_type,
       amount_value,
       completion_mode,
       due_note,
       sort_order,
       is_completed,
       completed_at,
       created_at,
       updated_at,
       deleted_at
     FROM project_milestones
     WHERE project_id = ?
       AND deleted_at IS NULL
     ORDER BY sort_order ASC, created_at ASC`,
    projectId,
  );
}

export async function getProjectMilestoneById(milestoneId: string): Promise<ProjectMilestone | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<ProjectMilestone>(
    `SELECT
       id,
       project_id,
       title,
       amount_type,
       amount_value,
       completion_mode,
       due_note,
       sort_order,
       is_completed,
       completed_at,
       created_at,
       updated_at,
       deleted_at
     FROM project_milestones
     WHERE id = ?
       AND deleted_at IS NULL`,
    milestoneId,
  );
  return row ?? null;
}

export async function updateProjectMilestone(input: {
  id: string;
  title: string;
  amount_type: MilestoneAmountType;
  amount_value: number;
  completion_mode: MilestoneCompletionMode;
  due_note?: string | null;
  sort_order: number;
}): Promise<void> {
  if (input.amount_type !== 'percent' && input.amount_type !== 'fixed') {
    throw new Error('Invalid milestone amount type.');
  }
  if (input.completion_mode !== 'toggle' && input.completion_mode !== 'checklist') {
    throw new Error('Invalid milestone completion mode.');
  }

  const numericAmount = Number(input.amount_value);
  if (!Number.isFinite(numericAmount) || numericAmount < 0) {
    throw new Error('Milestone amount must be a non-negative number.');
  }

  const db = await getDb();
  const result = await db.runAsync(
    `UPDATE project_milestones
       SET title = ?,
           amount_type = ?,
           amount_value = ?,
           completion_mode = ?,
           due_note = ?,
           sort_order = ?,
           updated_at = ?
     WHERE id = ?
       AND deleted_at IS NULL`,
    input.title,
    input.amount_type,
    numericAmount,
    input.completion_mode,
    input.due_note ?? null,
    Math.trunc(input.sort_order),
    nowIso(),
    input.id,
  );

  if (result.changes === 0) {
    throw new Error('Milestone not found');
  }
}

export async function deleteProjectMilestone(milestoneId: string): Promise<void> {
  const db = await getDb();
  const timestamp = nowIso();
  await db.runAsync(
    `UPDATE project_milestones
       SET deleted_at = ?,
           updated_at = ?
     WHERE id = ?
       AND deleted_at IS NULL`,
    timestamp,
    timestamp,
    milestoneId,
  );

  await db.runAsync(
    `UPDATE milestone_checklist_items
       SET deleted_at = ?,
           updated_at = ?
     WHERE milestone_id = ?
       AND deleted_at IS NULL`,
    timestamp,
    timestamp,
    milestoneId,
  );
}

export async function setProjectMilestoneCompletion(input: {
  milestoneId: string;
  isCompleted: boolean;
  completedAtIso?: string | null;
}): Promise<void> {
  const db = await getDb();
  const completedAt = input.isCompleted ? (input.completedAtIso ?? nowIso()) : null;
  const result = await db.runAsync(
    `UPDATE project_milestones
       SET is_completed = ?,
           completed_at = ?,
           updated_at = ?
     WHERE id = ?
       AND deleted_at IS NULL`,
    input.isCompleted ? 1 : 0,
    completedAt,
    nowIso(),
    input.milestoneId,
  );

  if (result.changes === 0) {
    throw new Error('Milestone not found');
  }
}

export async function createMilestoneChecklistItem(input: {
  id: string;
  milestone_id: string;
  label: string;
  sort_order: number;
}): Promise<void> {
  const db = await getDb();
  const timestamp = nowIso();
  const normalizedSortOrder = Number.isFinite(input.sort_order) ? Math.trunc(input.sort_order) : 0;

  await db.runAsync(
    `INSERT INTO milestone_checklist_items (
      id,
      milestone_id,
      label,
      sort_order,
      is_completed,
      completed_at,
      created_at,
      updated_at,
      deleted_at
    )
     VALUES (?, ?, ?, ?, 0, NULL, ?, ?, NULL)`,
    input.id,
    input.milestone_id,
    input.label,
    normalizedSortOrder,
    timestamp,
    timestamp,
  );
}

export async function listMilestoneChecklistItems(
  milestoneId: string,
): Promise<MilestoneChecklistItem[]> {
  const db = await getDb();
  return db.getAllAsync<MilestoneChecklistItem>(
    `SELECT
       id,
       milestone_id,
       label,
       sort_order,
       is_completed,
       completed_at,
       created_at,
       updated_at,
       deleted_at
     FROM milestone_checklist_items
     WHERE milestone_id = ?
       AND deleted_at IS NULL
     ORDER BY sort_order ASC, created_at ASC`,
    milestoneId,
  );
}

export async function updateMilestoneChecklistItem(input: {
  id: string;
  label: string;
  sort_order: number;
  is_completed: boolean;
  completed_at?: string | null;
}): Promise<void> {
  const db = await getDb();
  const result = await db.runAsync(
    `UPDATE milestone_checklist_items
       SET label = ?,
           sort_order = ?,
           is_completed = ?,
           completed_at = ?,
           updated_at = ?
     WHERE id = ?
       AND deleted_at IS NULL`,
    input.label,
    Math.trunc(input.sort_order),
    input.is_completed ? 1 : 0,
    input.is_completed ? (input.completed_at ?? nowIso()) : null,
    nowIso(),
    input.id,
  );

  if (result.changes === 0) {
    throw new Error('Checklist item not found');
  }
}

export async function listMilestoneChecklistItemsByMilestoneIds(
  milestoneIds: string[],
): Promise<MilestoneChecklistItem[]> {
  if (milestoneIds.length === 0) {
    return [];
  }

  const db = await getDb();
  const placeholders = milestoneIds.map(() => '?').join(',');
  return db.getAllAsync<MilestoneChecklistItem>(
    `SELECT
       id,
       milestone_id,
       label,
       sort_order,
       is_completed,
       completed_at,
       created_at,
       updated_at,
       deleted_at
     FROM milestone_checklist_items
     WHERE milestone_id IN (${placeholders})
       AND deleted_at IS NULL
     ORDER BY milestone_id ASC, sort_order ASC, created_at ASC`,
    ...milestoneIds,
  );
}

export async function areMilestoneChecklistItemsComplete(milestoneId: string): Promise<boolean> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ total_items: number; open_items: number }>(
    `SELECT
       COUNT(*) AS total_items,
       SUM(CASE WHEN is_completed = 0 THEN 1 ELSE 0 END) AS open_items
     FROM milestone_checklist_items
     WHERE milestone_id = ?
       AND deleted_at IS NULL`,
    milestoneId,
  );
  const totalItems = row?.total_items ?? 0;
  const openItems = row?.open_items ?? 0;
  return totalItems > 0 && openItems === 0;
}
