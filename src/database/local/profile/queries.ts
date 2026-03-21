import type { UserProfile } from '@/database/types';
import {
  ensureUserProfileRow,
  getDb,
  nowIso,
  USER_PROFILE_ID,
} from '@/database/local/shared/runtime';

export async function getUserProfile(): Promise<UserProfile> {
  const db = await getDb();
  await ensureUserProfileRow(db);
  const row = await db.getFirstAsync<UserProfile>(
    `SELECT
       id,
       company_name,
       logo_url,
       full_name,
       phone,
       email,
       github_pat,
       created_at,
       updated_at
     FROM user_profile
     WHERE id = ?`,
    USER_PROFILE_ID,
  );

  if (!row) {
    throw new Error('User profile could not be loaded');
  }

  return row;
}

export async function upsertUserProfile(input: {
  company_name?: string | null;
  logo_url?: string | null;
  full_name?: string | null;
  phone?: string | null;
  email?: string | null;
  github_pat?: string | null;
}): Promise<void> {
  const db = await getDb();
  await ensureUserProfileRow(db);
  const existing = await getUserProfile();
  const timestamp = nowIso();
  const nextCompanyName = input.company_name === undefined ? existing.company_name : input.company_name;
  const nextLogoUrl = input.logo_url === undefined ? existing.logo_url : input.logo_url;
  const nextFullName = input.full_name === undefined ? existing.full_name : input.full_name;
  const nextPhone = input.phone === undefined ? existing.phone : input.phone;
  const nextEmail = input.email === undefined ? existing.email : input.email;
  const nextGithubPat = input.github_pat === undefined ? existing.github_pat : input.github_pat;

  await db.runAsync(
    `UPDATE user_profile
       SET company_name = ?,
           logo_url = ?,
           full_name = ?,
           phone = ?,
           email = ?,
           github_pat = ?,
           updated_at = ?
     WHERE id = ?`,
    nextCompanyName ?? null,
    nextLogoUrl ?? null,
    nextFullName ?? null,
    nextPhone ?? null,
    nextEmail ?? null,
    nextGithubPat ?? null,
    timestamp,
    USER_PROFILE_ID,
  );
}
