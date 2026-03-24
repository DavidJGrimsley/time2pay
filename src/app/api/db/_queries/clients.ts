import { sql } from 'drizzle-orm';
import type { WriteDb } from '@/app/api/db/_shared/db';
import { validation } from '@/app/api/db/_shared/errors';
import { assertUpdated, toNumericString } from '@/app/api/db/_queries/_shared';
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
  if (!input.id.trim() || !input.name.trim()) {
    throw validation('Client id and name are required.');
  }

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
      ${toNumericString(input.hourlyRate ?? 0)},
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
  if (!input.id.trim() || !input.name.trim()) {
    throw validation('Client id and name are required.');
  }

  const timestamp = nowIso();
  await assertUpdated(
    db,
    sql`
      update clients
      set
        name = ${input.name},
        email = ${input.email ?? null},
        phone = ${input.phone ?? null},
        updated_at = ${timestamp}
      where id = ${input.id}
        and auth_user_id = ${authUserId}::uuid
        and deleted_at is null
      returning id
    `,
    'Client not found.',
  );
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
  if (!Number.isFinite(input.hourlyRate) || input.hourlyRate < 0) {
    throw validation('Hourly rate must be a non-negative number.');
  }

  const timestamp = nowIso();
  await assertUpdated(
    db,
    sql`
      update clients
      set hourly_rate = ${toNumericString(input.hourlyRate)}, updated_at = ${timestamp}
      where id = ${input.id}
        and auth_user_id = ${authUserId}::uuid
        and deleted_at is null
      returning id
    `,
    'Client not found.',
  );
}
