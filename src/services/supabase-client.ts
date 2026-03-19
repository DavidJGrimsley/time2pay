import {
  createClient,
  type AuthChangeEvent,
  type Session,
  type SupabaseClient,
  type User,
} from '@supabase/supabase-js';
import { assertHostedModeConfigured } from '@/services/runtime-mode';

let supabaseClient: SupabaseClient | null = null;
const DEFAULT_AUTH_REDIRECT_PATH = '/dashboard';

function getSupabaseConfig(): { url: string; anonKey: string } {
  assertHostedModeConfigured();

  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
  const anonKey =
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ??
    process.env.EXPO_PUBLIC_SUPABASE_KEY?.trim() ??
    '';

  if (!url || !anonKey) {
    throw new Error('Supabase is not configured for hosted mode.');
  }

  return { url, anonKey };
}

export function getSupabaseClient(): SupabaseClient {
  if (supabaseClient) {
    return supabaseClient;
  }

  const { url, anonKey } = getSupabaseConfig();
  supabaseClient = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });

  return supabaseClient;
}

export async function getSupabaseSession(): Promise<Session | null> {
  const client = getSupabaseClient();
  const { data, error } = await client.auth.getSession();
  if (error) {
    throw new Error(error.message);
  }

  return data.session;
}

export async function getSupabaseUser(): Promise<User | null> {
  const client = getSupabaseClient();
  const { data, error } = await client.auth.getUser();
  if (error) {
    throw new Error(error.message);
  }

  return data.user;
}

export async function requireSupabaseUserId(): Promise<string> {
  const user = await getSupabaseUser();
  if (!user?.id) {
    throw new Error('You must be signed in to access hosted data.');
  }

  return user.id;
}

export async function signInWithMagicLink(email: string): Promise<void> {
  const client = getSupabaseClient();
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error('Email is required.');
  }

  const emailRedirectTo = resolveSupabaseAuthRedirectUrl();

  const { error } = await client.auth.signInWithOtp({
    email: normalizedEmail,
    options: {
      emailRedirectTo,
    },
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function signInWithGitHubOAuth(): Promise<void> {
  const client = getSupabaseClient();
  const redirectTo = resolveSupabaseAuthRedirectUrl();
  const { error } = await client.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo,
      scopes: 'read:user user:email',
    },
  });

  if (error) {
    throw new Error(error.message);
  }
}

export function resolveSupabaseAuthRedirectUrl(): string | undefined {
  const explicitUrl = process.env.EXPO_PUBLIC_SUPABASE_AUTH_REDIRECT_URL?.trim() ?? '';
  if (explicitUrl) {
    return explicitUrl;
  }

  if (typeof window === 'undefined') {
    return undefined;
  }

  const redirectPath = process.env.EXPO_PUBLIC_SUPABASE_AUTH_REDIRECT_PATH?.trim() || DEFAULT_AUTH_REDIRECT_PATH;
  return `${window.location.origin}${redirectPath.startsWith('/') ? redirectPath : `/${redirectPath}`}`;
}

export async function signOutSupabase(): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await client.auth.signOut();
  if (error) {
    throw new Error(error.message);
  }
}

export function onSupabaseAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
): () => void {
  const client = getSupabaseClient();
  const { data } = client.auth.onAuthStateChange(callback);

  return () => {
    data.subscription.unsubscribe();
  };
}
