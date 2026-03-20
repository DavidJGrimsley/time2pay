import { sql } from 'drizzle-orm';
import type { WriteDb } from '@/app/api/db/_shared/db';
import { nowIso } from '@/app/api/db/_shared/parsers';

export type CreateTaskInput = {
  id: string;
  projectId: string;
  name: string;
  githubBranch?: string | null;
};

export async function createTask(
  db: WriteDb,
  authUserId: string,
  input: CreateTaskInput,
): Promise<void> {
  const timestamp = nowIso();
  await db.execute(sql`
    insert into tasks (
      id, auth_user_id, project_id, name, github_branch, created_at, updated_at, deleted_at
    ) values (
      ${input.id},
      ${authUserId}::uuid,
      ${input.projectId},
      ${input.name},
      ${input.githubBranch ?? null},
      ${timestamp},
      ${timestamp},
      null
    )
  `);
}
