import { getSupabaseClient, getSupabaseUser, requireSupabaseUserId } from '@/services/supabase-client';
import type { UserProfile } from '@/database/hosted/types';
import { requireConfiguredSiteOrigin, resolveBrowserSiteOrigin } from '@/services/site-origin';

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
  invoice_builder_mode: 't2p' | 'mercury' | null;
  created_at: string;
  updated_at: string;
};

function toNullableNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function isDuplicateProfileInsertError(error: { code?: string } | null): boolean {
  return error?.code === '23505';
}

export async function ensureHostedProfileRow(userId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const authUser = await getSupabaseUser();
  const metadata = (authUser?.user_metadata ?? {}) as Record<string, unknown>;
  const metadataName =
    toNullableNonEmptyString(metadata.full_name) ??
    toNullableNonEmptyString(metadata.name) ??
    toNullableNonEmptyString(metadata.user_name);
  const metadataEmail = toNullableNonEmptyString(authUser?.email);
  const timestamp = nowIso();

  const readExistingRow = async () =>
    supabase
      .from('user_profiles')
      .select('auth_user_id,full_name,email')
      .eq('auth_user_id', userId)
      .maybeSingle();

  const { data: existingRow, error: existingRowError } = await readExistingRow();

  if (existingRowError) {
    throw new Error(existingRowError.message);
  }

  let profileRow = existingRow;

  if (!profileRow) {
    const { error: insertError } = await supabase.from('user_profiles').insert({
      auth_user_id: userId,
      id: 'me',
      full_name: metadataName,
      email: metadataEmail,
      invoice_builder_mode: 't2p',
      created_at: timestamp,
      updated_at: timestamp,
    });

    if (insertError) {
      if (!isDuplicateProfileInsertError(insertError)) {
        throw new Error(insertError.message);
      }

      const { data: duplicateRow, error: duplicateRowError } = await readExistingRow();
      if (duplicateRowError) {
        throw new Error(duplicateRowError.message);
      }

      if (!duplicateRow) {
        return;
      }

      profileRow = duplicateRow;
    } else {
      return;
    }
  }

  const nextFullName = toNullableNonEmptyString(profileRow.full_name) ?? metadataName;
  const nextEmail = toNullableNonEmptyString(profileRow.email) ?? metadataEmail;
  const shouldUpdate =
    nextFullName !== (profileRow.full_name ?? null) || nextEmail !== (profileRow.email ?? null);

  if (!shouldUpdate) {
    return;
  }

  const { error: updateError } = await supabase
    .from('user_profiles')
    .update({
      full_name: nextFullName,
      email: nextEmail,
      updated_at: timestamp,
    })
    .eq('auth_user_id', userId);

  if (updateError) {
    throw new Error(updateError.message);
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
    invoice_builder_mode: row.invoice_builder_mode === 'mercury' ? 'mercury' : 't2p',
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

export function normalizeHostedWriteError(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) {
    return 'We couldn’t save this change. Please refresh and try again.';
  }

  if (
    trimmed.includes('Hosted write route failed') ||
    trimmed.includes('Internal server error') ||
    trimmed.startsWith('<!DOCTYPE') ||
    trimmed.startsWith('<html') ||
    trimmed.startsWith('<body') ||
    trimmed.includes('TypeError') ||
    trimmed.includes('ReferenceError') ||
    trimmed.includes('Cannot read properties') ||
    /\bat\s+/.test(trimmed) ||
    trimmed.length > 180
  ) {
    return 'We couldn’t save this change. Please refresh and try again.';
  }

  return trimmed;
}

export function byId<T extends { id: string }>(rows: T[]): Map<string, T> {
  return new Map(rows.map((row) => [row.id, row]));
}

export function resolveHostedWriteUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const baseOrigin = resolveBrowserSiteOrigin();
  if (!baseOrigin) {
    requireConfiguredSiteOrigin();
  }
  return new URL(normalizedPath, baseOrigin).toString();
}

export async function callHostedWriteRoute(
  path: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const writeUrl = resolveHostedWriteUrl(path);
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error('Sign in to save changes to your hosted account.');
  }

  const token = data.session?.access_token?.trim();
  if (!token) {
    throw new Error('Sign in to save changes to your hosted account.');
  }

  const response = await fetch(writeUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const responseText = await response.text().catch(() => '');
    let body: { error?: string } = {};
    if (responseText) {
      try {
        body = (JSON.parse(responseText) as { error?: string }) ?? {};
      } catch {
        body = {};
      }
    }
    const serverMessage =
      typeof body.error === 'string' && body.error.trim()
        ? body.error.trim()
        : responseText.trim();
    throw new Error(
      normalizeHostedWriteError(serverMessage || `Hosted write route failed (HTTP ${response.status}).`),
    );
  }
}

export async function requireHostedUserId(): Promise<string> {
  return requireSupabaseUserId();
}
