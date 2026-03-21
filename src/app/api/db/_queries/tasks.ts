import { sql } from 'drizzle-orm';
import type { WriteDb } from '@/app/api/db/_shared/db';
import { notFound, validation } from '@/app/api/db/_shared/errors';
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
  if (!input.id.trim() || !input.projectId.trim() || !input.name.trim()) {
    throw validation('Task id, project id, and name are required.');
  }

  const projectResult = await db.execute(sql`
    select id
    from projects
    where id = ${input.projectId}
      and auth_user_id = ${authUserId}::uuid
      and deleted_at is null
    limit 1
  `);
  const projectRows = Array.isArray(projectResult)
    ? projectResult
    : ((projectResult as { rows?: unknown[] }).rows ?? []);
  if (projectRows.length === 0) {
    throw notFound('Project not found.');
  }

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
