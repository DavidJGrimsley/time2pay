import type { Session, User } from '@supabase/supabase-js';
import { isHostedMode } from '@/services/runtime-mode';
import { getSupabaseClient, getSupabaseSession } from '@/services/supabase-client';

export type GitHubSessionState = {
  isGitHubSession: boolean;
  providerToken: string | null;
  displayName: string | null;
};

function toTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function getGitHubMetadataDisplayName(user: User | null | undefined): string | null {
  const metadata = (user?.user_metadata ?? {}) as Record<string, unknown>;
  return (
    toTrimmedString(metadata.full_name) ??
    toTrimmedString(metadata.name) ??
    toTrimmedString(metadata.user_name) ??
    toTrimmedString(user?.email)
  );
}

function getProviderList(user: User | null | undefined): string[] {
  const metadata = (user?.app_metadata ?? {}) as Record<string, unknown>;
  const providers = metadata.providers;
  if (!Array.isArray(providers)) {
    return [];
  }

  return providers
    .map((provider) => toTrimmedString(provider)?.toLowerCase() ?? '')
    .filter(Boolean);
}

export function isGitHubSession(session: Session | null | undefined): boolean {
  const provider =
    toTrimmedString((session?.user?.app_metadata as Record<string, unknown> | undefined)?.provider)?.toLowerCase() ??
    null;
  if (provider === 'github') {
    return true;
  }

  if (!toTrimmedString(session?.provider_token)) {
    return false;
  }

  return getProviderList(session?.user).includes('github');
}

export function getGitHubSessionState(session: Session | null | undefined): GitHubSessionState {
  const isSessionFromGitHub = isGitHubSession(session);
  return {
    isGitHubSession: isSessionFromGitHub,
    providerToken: isSessionFromGitHub ? toTrimmedString(session?.provider_token) : null,
    displayName: isSessionFromGitHub ? getGitHubMetadataDisplayName(session?.user) : null,
  };
}

export async function getCurrentGitHubSessionState(): Promise<GitHubSessionState> {
  if (!isHostedMode()) {
    return {
      isGitHubSession: false,
      providerToken: null,
      displayName: null,
    };
  }

  try {
    return getGitHubSessionState(await getSupabaseSession());
  } catch {
    return {
      isGitHubSession: false,
      providerToken: null,
      displayName: null,
    };
  }
}

export async function resolveGitHubApiToken(
  profileToken?: string | null,
  session?: Session | null,
): Promise<string | null> {
  const savedProfileToken = toTrimmedString(profileToken);
  if (savedProfileToken) {
    return savedProfileToken;
  }

  if (session) {
    return getGitHubSessionState(session).providerToken;
  }

  return (await getCurrentGitHubSessionState()).providerToken;
}

export async function syncGitHubProviderTokenToHostedProfile(
  session?: Session | null,
): Promise<'saved' | 'unchanged' | 'skipped'> {
  if (!isHostedMode()) {
    return 'skipped';
  }

  const activeSession = session === undefined ? await getSupabaseSession() : session;
  const githubSession = getGitHubSessionState(activeSession);
  const authUserId = toTrimmedString(activeSession?.user?.id);

  if (!githubSession.isGitHubSession || !githubSession.providerToken || !authUserId) {
    return 'skipped';
  }

  const supabase = getSupabaseClient();
  const { data: existingRow, error: existingRowError } = await supabase
    .from('user_profiles')
    .select('auth_user_id,github_pat')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  if (existingRowError) {
    throw new Error(existingRowError.message);
  }

  const timestamp = new Date().toISOString();
  const nextToken = githubSession.providerToken;
  const existingToken = toTrimmedString(existingRow?.github_pat);

  if (existingToken === nextToken) {
    return 'unchanged';
  }

  if (existingRow) {
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({
        github_pat: nextToken,
        updated_at: timestamp,
      })
      .eq('auth_user_id', authUserId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return 'saved';
  }

  const insertPayload = {
    auth_user_id: authUserId,
    id: 'me',
    full_name: getGitHubMetadataDisplayName(activeSession?.user),
    email: activeSession?.user?.email ?? null,
    github_pat: nextToken,
    created_at: timestamp,
    updated_at: timestamp,
  };

  const { error: insertError } = await supabase.from('user_profiles').insert(insertPayload);
  if (!insertError) {
    return 'saved';
  }

  if (insertError.code === '23505') {
    const { error: retryUpdateError } = await supabase
      .from('user_profiles')
      .update({
        github_pat: nextToken,
        updated_at: timestamp,
      })
      .eq('auth_user_id', authUserId);

    if (retryUpdateError) {
      throw new Error(retryUpdateError.message);
    }

    return 'saved';
  }

  throw new Error(insertError.message);
}
