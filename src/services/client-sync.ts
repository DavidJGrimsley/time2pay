import { createClient } from '@/database/db';
import { ensureMercuryCustomer } from '@/services/mercury';

type CreateClientInput = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  hourly_rate?: number;
  github_org?: string | null;
};

export type ClientMercurySyncResult = {
  mercurySyncStatus: 'synced' | 'skipped' | 'deferred';
  mercuryMessage?: string;
};

function normalizeRequiredEmail(email: string | null | undefined): string {
  const trimmed = email?.trim() ?? '';
  if (!trimmed) {
    throw new Error('Customer email is required.');
  }

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!validEmail.test(trimmed)) {
    throw new Error('Enter a valid customer email address.');
  }

  return trimmed;
}

export async function createTime2PayClient(
  input: CreateClientInput,
): Promise<ClientMercurySyncResult> {
  const name = input.name.trim();
  if (!name) {
    throw new Error('Customer name is required.');
  }

  const email = normalizeRequiredEmail(input.email);

  await createClient({
    ...input,
    name,
    email,
  });

  try {
    await ensureMercuryCustomer({ name, email });
    return {
      mercurySyncStatus: 'synced',
    };
  } catch (error: unknown) {
    return {
      mercurySyncStatus: 'deferred',
      mercuryMessage:
        error instanceof Error ? error.message : 'Mercury customer sync could not be completed.',
    };
  }
}
