import { sql } from 'drizzle-orm';
import type { WriteDb } from '@/app/api/db/_shared/db';
import { nowIso } from '@/app/api/db/_shared/parsers';

export type CreateClientInput = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  hourlyRate?: number;
  githubOrg?: string | null;
};

export async function createClient(
  db: WriteDb,
  authUserId: string,
  input: CreateClientInput,
): Promise<void> {
  const timestamp = nowIso();
  await db.execute(sql`
    insert into clients (
      id, auth_user_id, name, email, phone, hourly_rate, github_org, created_at, updated_at, deleted_at
    ) values (
      ${input.id},
      ${authUserId}::uuid,
      ${input.name},
      ${input.email ?? null},
      ${input.phone ?? null},
      ${String(input.hourlyRate ?? 0)},
      ${input.githubOrg ?? null},
      ${timestamp},
      ${timestamp},
      null
    )
  `);
}

export type UpdateClientContactInput = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
};

export async function updateClientContact(
  db: WriteDb,
  authUserId: string,
  input: UpdateClientContactInput,
): Promise<void> {
  const timestamp = nowIso();
  await db.execute(sql`
    update clients
    set
      name = ${input.name},
      email = ${input.email ?? null},
      phone = ${input.phone ?? null},
      updated_at = ${timestamp}
    where id = ${input.id}
      and auth_user_id = ${authUserId}::uuid
      and deleted_at is null
  `);
}

export type UpdateClientHourlyRateInput = {
  id: string;
  hourlyRate: number;
};

export async function updateClientHourlyRate(
  db: WriteDb,
  authUserId: string,
  input: UpdateClientHourlyRateInput,
): Promise<void> {
  const timestamp = nowIso();
  await db.execute(sql`
    update clients
    set hourly_rate = ${String(input.hourlyRate)}, updated_at = ${timestamp}
    where id = ${input.id}
      and auth_user_id = ${authUserId}::uuid
      and deleted_at is null
  `);
}
