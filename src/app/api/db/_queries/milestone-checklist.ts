import { sql } from 'drizzle-orm';
import type { WriteDb } from '@/app/api/db/_shared/db';
import { notFound, validation } from '@/app/api/db/_shared/errors';
import { assertUpdated } from '@/app/api/db/_queries/_shared';
import { nowIso, toIsoOrNow } from '@/app/api/db/_shared/parsers';

export type CreateMilestoneChecklistItemInput = {
  id: string;
  milestoneId: string;
  label: string;
  sortOrder: number;
};

export async function createMilestoneChecklistItem(
  db: WriteDb,
  authUserId: string,
  input: CreateMilestoneChecklistItemInput,
): Promise<void> {
  if (!input.id.trim() || !input.milestoneId.trim() || !input.label.trim()) {
    throw validation('Checklist id, milestone id, and label are required.');
  }

  const milestoneResult = await db.execute(sql`
    select id
    from project_milestones
    where id = ${input.milestoneId}
      and auth_user_id = ${authUserId}::uuid
      and deleted_at is null
    limit 1
  `);
  const milestoneRows = Array.isArray(milestoneResult)
    ? milestoneResult
    : ((milestoneResult as { rows?: unknown[] }).rows ?? []);
  if (milestoneRows.length === 0) {
    throw notFound('Milestone not found.');
  }

  const timestamp = nowIso();
  await db.execute(sql`
    insert into milestone_checklist_items (
      id, auth_user_id, milestone_id, label, sort_order, is_completed, completed_at, created_at, updated_at, deleted_at
    ) values (
      ${input.id},
      ${authUserId}::uuid,
      ${input.milestoneId},
      ${input.label},
      ${Math.trunc(input.sortOrder)},
      false,
      null,
      ${timestamp},
      ${timestamp},
      null
    )
  `);
}

export type UpdateMilestoneChecklistItemInput = {
  id: string;
  label: string;
  sortOrder: number;
  isCompleted: boolean;
  completedAt?: string | null;
};

export async function updateMilestoneChecklistItem(
  db: WriteDb,
  authUserId: string,
  input: UpdateMilestoneChecklistItemInput,
): Promise<void> {
  const timestamp = nowIso();
  const completedAt = input.isCompleted ? toIsoOrNow(input.completedAt ?? null) : null;
  await assertUpdated(
    db,
    sql`
      update milestone_checklist_items
      set
        label = ${input.label},
        sort_order = ${Math.trunc(input.sortOrder)},
        is_completed = ${input.isCompleted},
        completed_at = ${completedAt},
        updated_at = ${timestamp}
      where id = ${input.id}
        and auth_user_id = ${authUserId}::uuid
        and deleted_at is null
      returning id
    `,
    'Checklist item not found.',
  );
}
