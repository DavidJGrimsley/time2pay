import { sql } from 'drizzle-orm';
import type { WriteDb } from '@/app/api/db/_shared/db';
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
      ${input.totalProjectFee === null || input.totalProjectFee === undefined
        ? null
        : String(input.totalProjectFee)},
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
  const timestamp = nowIso();
  await db.execute(sql`
    update projects
    set
      pricing_mode = ${input.pricingMode},
      total_project_fee = ${input.totalProjectFee === null ? null : String(input.totalProjectFee)},
      updated_at = ${timestamp}
    where id = ${input.id}
      and auth_user_id = ${authUserId}::uuid
      and deleted_at is null
  `);
}
