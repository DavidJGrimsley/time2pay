import { getSupabaseClient } from '@/services/supabase-client';
import {
  ensureHostedProfileRow,
  nowIso,
  requireHostedUserId,
  toUserProfile,
  type UserProfileRow,
} from '@/database/hosted/shared/runtime';
import type { UserProfile } from '@/database/hosted/types';

export async function getUserProfile(): Promise<UserProfile> {
  const supabase = getSupabaseClient();
  const userId = await requireHostedUserId();
  await ensureHostedProfileRow(userId);

  const { data, error } = await supabase
    .from('user_profiles')
    .select('auth_user_id,id,company_name,logo_url,full_name,phone,email,github_pat,created_at,updated_at')
    .eq('auth_user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error('User profile could not be loaded');
  }

  return toUserProfile(data as UserProfileRow);
}

export async function upsertUserProfile(input: {
  company_name?: string | null;
  logo_url?: string | null;
  full_name?: string | null;
  phone?: string | null;
  email?: string | null;
  github_pat?: string | null;
}): Promise<void> {
  const supabase = getSupabaseClient();
  const userId = await requireHostedUserId();
  const existing = await getUserProfile();
  const timestamp = nowIso();

  const { error } = await supabase
    .from('user_profiles')
    .update({
      company_name: input.company_name === undefined ? existing.company_name : input.company_name,
      logo_url: input.logo_url === undefined ? existing.logo_url : input.logo_url,
      full_name: input.full_name === undefined ? existing.full_name : input.full_name,
      phone: input.phone === undefined ? existing.phone : input.phone,
      email: input.email === undefined ? existing.email : input.email,
      github_pat: input.github_pat === undefined ? existing.github_pat : input.github_pat,
      updated_at: timestamp,
    })
    .eq('auth_user_id', userId);

  if (error) {
    throw new Error(error.message);
  }
}
