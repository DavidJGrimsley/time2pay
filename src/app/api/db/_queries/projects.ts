import { sql } from 'drizzle-orm';
import type { WriteDb } from '@/app/api/db/_shared/db';
import { notFound, validation } from '@/app/api/db/_shared/errors';
import { assertUpdated, toNumericString } from '@/app/api/db/_queries/_shared';
import { nowIso } from '@/app/api/db/_shared/parsers';

export type CreateProjectInput = {
  id: string;
  clientId: string;
  name: string;
  githubRepo?: string | null;
  pricingMode?: 'hourly' | 'milestone';
  totalProjectFee?: number | null;
};

export async function createProject(
  db: WriteDb,
  authUserId: string,
  input: CreateProjectInput,
): Promise<void> {
  if (!input.id.trim() || !input.clientId.trim() || !input.name.trim()) {
    throw validation('Project id, client id, and name are required.');
  }

  const clientResult = await db.execute(sql`
    select id
    from clients
    where id = ${input.clientId}
      and auth_user_id = ${authUserId}::uuid
      and deleted_at is null
    limit 1
  `);
  const clientRows = Array.isArray(clientResult)
    ? clientResult
    : ((clientResult as { rows?: unknown[] }).rows ?? []);
  if (clientRows.length === 0) {
    throw notFound('Client not found.');
  }

  const timestamp = nowIso();
  await db.execute(sql`
    insert into projects (
      id, auth_user_id, client_id, name, github_repo, pricing_mode, total_project_fee, created_at, updated_at, deleted_at
    ) values (
      ${input.id},
      ${authUserId}::uuid,
      ${input.clientId},
      ${input.name},
      ${input.githubRepo ?? null},
      ${input.pricingMode ?? 'hourly'},
      ${toNumericString(input.totalProjectFee)},
      ${timestamp},
      ${timestamp},
      null
    )
  `);
}

export type UpdateProjectPricingInput = {
  id: string;
  pricingMode: 'hourly' | 'milestone';
  totalProjectFee: number | null;
};

export async function updateProjectPricing(
  db: WriteDb,
  authUserId: string,
  input: UpdateProjectPricingInput,
): Promise<void> {
  if (input.totalProjectFee !== null && (!Number.isFinite(input.totalProjectFee) || input.totalProjectFee < 0)) {
    throw validation('Project fee must be a non-negative number when set.');
  }

  const timestamp = nowIso();
  await assertUpdated(
    db,
    sql`
      update projects
      set
        pricing_mode = ${input.pricingMode},
        total_project_fee = ${toNumericString(input.totalProjectFee)},
        updated_at = ${timestamp}
      where id = ${input.id}
        and auth_user_id = ${authUserId}::uuid
        and deleted_at is null
      returning id
    `,
    'Project not found.',
  );
}
