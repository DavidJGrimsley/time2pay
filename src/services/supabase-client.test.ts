import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveSupabaseAuthRedirectUrl } from '@/services/supabase-client';

const ORIGINAL_ENV = {
  EXPO_PUBLIC_SUPABASE_AUTH_REDIRECT_URL: process.env.EXPO_PUBLIC_SUPABASE_AUTH_REDIRECT_URL,
  EXPO_PUBLIC_SUPABASE_AUTH_REDIRECT_PATH: process.env.EXPO_PUBLIC_SUPABASE_AUTH_REDIRECT_PATH,
};

afterEach(() => {
  process.env.EXPO_PUBLIC_SUPABASE_AUTH_REDIRECT_URL = ORIGINAL_ENV.EXPO_PUBLIC_SUPABASE_AUTH_REDIRECT_URL;
  process.env.EXPO_PUBLIC_SUPABASE_AUTH_REDIRECT_PATH = ORIGINAL_ENV.EXPO_PUBLIC_SUPABASE_AUTH_REDIRECT_PATH;
  Reflect.deleteProperty(globalThis, 'window');
  vi.restoreAllMocks();
});

describe('resolveSupabaseAuthRedirectUrl', () => {
  it('prefers explicit redirect URL when configured', () => {
    process.env.EXPO_PUBLIC_SUPABASE_AUTH_REDIRECT_URL = 'https://time2pay.app/dashboard';
    (globalThis as Record<string, unknown>).window = { location: { origin: 'http://localhost:3000' } };

    expect(resolveSupabaseAuthRedirectUrl()).toBe('https://time2pay.app/dashboard');
  });

  it('builds redirect URL from current origin and configured path', () => {
    process.env.EXPO_PUBLIC_SUPABASE_AUTH_REDIRECT_URL = '';
    process.env.EXPO_PUBLIC_SUPABASE_AUTH_REDIRECT_PATH = 'auth/callback';
    (globalThis as Record<string, unknown>).window = { location: { origin: 'http://localhost:3000' } };

    expect(resolveSupabaseAuthRedirectUrl()).toBe('http://localhost:3000/auth/callback');
  });

  it('returns undefined when called server-side without explicit URL', () => {
    process.env.EXPO_PUBLIC_SUPABASE_AUTH_REDIRECT_URL = '';
    process.env.EXPO_PUBLIC_SUPABASE_AUTH_REDIRECT_PATH = '/dashboard';

    expect(resolveSupabaseAuthRedirectUrl()).toBeUndefined();
  });
});
