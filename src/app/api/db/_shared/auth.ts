import { createClient } from '@supabase/supabase-js';

function getSupabaseAuthConfig(): { url: string; anonKey: string } {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? process.env.SUPABASE_URL?.trim() ?? '';
  const anonKey =
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ??
    process.env.EXPO_PUBLIC_SUPABASE_KEY?.trim() ??
    process.env.SUPABASE_ANON_KEY?.trim() ??
    '';

  if (!url || !anonKey) {
    throw new Error('Supabase auth config missing. Set SUPABASE_URL and SUPABASE_ANON_KEY.');
  }

  return { url, anonKey };
}

export async function requireAuthUserId(request: Request): Promise<string> {
  const authorization = request.headers.get('authorization') ?? '';
  const token = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length).trim()
    : '';
  if (!token) {
    throw new Error('Missing Bearer token.');
  }

  const { url, anonKey } = getSupabaseAuthConfig();
  const supabase = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.id) {
    throw new Error('Invalid Supabase session token.');
  }

  return data.user.id;
}
