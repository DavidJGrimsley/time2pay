import { sql } from 'drizzle-orm';
import type { WriteDb } from '@/app/api/db/_shared/db';
import { nowIso, toIsoOrNow } from '@/app/api/db/_shared/parsers';

export type CreateMilestoneInput = {
  id: string;
  projectId: string;
  title: string;
  amountType: 'percent' | 'fixed';
  amountValue: number;
  completionMode: 'toggle' | 'checklist';
  dueNote?: string | null;
  sortOrder: number;
};

export async function createMilestone(
  db: WriteDb,
  authUserId: string,
  input: CreateMilestoneInput,
): Promise<void> {
  const timestamp = nowIso();
  await db.execute(sql`
    insert into project_milestones (
      id, auth_user_id, project_id, title, amount_type, amount_value, completion_mode,
      due_note, sort_order, is_completed, completed_at, created_at, updated_at, deleted_at
    ) values (
      ${input.id},
      ${authUserId}::uuid,
      ${input.projectId},
      ${input.title},
      ${input.amountType},
      ${String(input.amountValue)},
      ${input.completionMode},
      ${input.dueNote ?? null},
      ${Math.trunc(input.sortOrder)},
      false,
      null,
      ${timestamp},
      ${timestamp},
      null
    )
  `);
}

export type UpdateMilestoneInput = {
  id: string;
  title: string;
  amountType: 'percent' | 'fixed';
  amountValue: number;
  completionMode: 'toggle' | 'checklist';
  dueNote?: string | null;
  sortOrder: number;
};

export async function updateMilestone(
  db: WriteDb,
  authUserId: string,
  input: UpdateMilestoneInput,
): Promise<void> {
  const timestamp = nowIso();
  await db.execute(sql`
    update project_milestones
    set
      title = ${input.title},
      amount_type = ${input.amountType},
      amount_value = ${String(input.amountValue)},
      completion_mode = ${input.completionMode},
      due_note = ${input.dueNote ?? null},
      sort_order = ${Math.trunc(input.sortOrder)},
      updated_at = ${timestamp}
    where id = ${input.id}
      and auth_user_id = ${authUserId}::uuid
      and deleted_at is null
  `);
}

export type DeleteMilestoneInput = {
  milestoneId: string;
};

export async function deleteMilestone(
  db: WriteDb,
  authUserId: string,
  input: DeleteMilestoneInput,
): Promise<void> {
  const timestamp = nowIso();
  await db.execute(sql`
    update project_milestones
    set deleted_at = ${timestamp}, updated_at = ${timestamp}
    where id = ${input.milestoneId}
      and auth_user_id = ${authUserId}::uuid
      and deleted_at is null
  `);
  await db.execute(sql`
    update milestone_checklist_items
    set deleted_at = ${timestamp}, updated_at = ${timestamp}
    where milestone_id = ${input.milestoneId}
      and auth_user_id = ${authUserId}::uuid
      and deleted_at is null
  `);
}

export type SetMilestoneCompletionInput = {
  milestoneId: string;
  isCompleted: boolean;
  completedAt?: string | null;
};

export async function setMilestoneCompletion(
  db: WriteDb,
  authUserId: string,
  input: SetMilestoneCompletionInput,
): Promise<void> {
  const timestamp = nowIso();
  const completedAt = input.isCompleted ? toIsoOrNow(input.completedAt ?? null) : null;
  await db.execute(sql`
    update project_milestones
    set
      is_completed = ${input.isCompleted},
      completed_at = ${completedAt},
      updated_at = ${timestamp}
    where id = ${input.milestoneId}
      and auth_user_id = ${authUserId}::uuid
      and deleted_at is null
  `);
}
