import { getSupabaseClient, getSupabaseUser, requireSupabaseUserId } from '@/services/supabase-client';
import type { UserProfile } from '@/database/hosted/types';

export function nowIso(): string {
  return new Date().toISOString();
}

export type UserProfileRow = {
  auth_user_id: string;
  id: string;
  company_name: string | null;
  logo_url: string | null;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  github_pat: string | null;
  created_at: string;
  updated_at: string;
};

export async function ensureHostedProfileRow(userId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const authUser = await getSupabaseUser();
  const metadata = (authUser?.user_metadata ?? {}) as Record<string, unknown>;
  const metadataName =
    typeof metadata.full_name === 'string'
      ? metadata.full_name
      : typeof metadata.name === 'string'
        ? metadata.name
        : typeof metadata.user_name === 'string'
          ? metadata.user_name
          : null;
  const timestamp = nowIso();

  const { error } = await supabase.from('user_profiles').upsert(
    {
      auth_user_id: userId,
      id: 'me',
      full_name: metadataName,
      email: authUser?.email ?? null,
      created_at: timestamp,
      updated_at: timestamp,
    },
    {
      onConflict: 'auth_user_id',
      ignoreDuplicates: true,
    },
  );

  if (error) {
    throw new Error(error.message);
  }
}

export function toUserProfile(row: UserProfileRow): UserProfile {
  return {
    id: row.id,
    company_name: row.company_name,
    logo_url: row.logo_url,
    full_name: row.full_name,
    phone: row.phone,
    email: row.email,
    github_pat: row.github_pat,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function withHostedRead<T>(read: () => Promise<T>): Promise<T> {
  return read();
}

export function toNumber(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = toNumber(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function byId<T extends { id: string }>(rows: T[]): Map<string, T> {
  return new Map(rows.map((row) => [row.id, row]));
}

export async function callHostedWriteRoute(
  path: string,
  payload: Record<string, unknown>,
): Promise<void> {
  if (typeof window === 'undefined') {
    throw new Error('Hosted write route is only available in web runtime for now.');
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error(error.message);
  }

  const token = data.session?.access_token?.trim();
  if (!token) {
    throw new Error('Hosted write route requires an active Supabase session.');
  }

  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? 'Hosted write route failed.');
  }
}

export async function requireHostedUserId(): Promise<string> {
  return requireSupabaseUserId();
}
