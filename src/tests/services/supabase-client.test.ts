import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveSupabaseAuthRedirectUrl } from '@/services/supabase-client';

const ORIGINAL_ENV = {
  EXPO_PUBLIC_TIME2PAY_DATA_MODE: process.env.EXPO_PUBLIC_TIME2PAY_DATA_MODE,
  EXPO_PUBLIC_SITE_ORIGIN: process.env.EXPO_PUBLIC_SITE_ORIGIN,
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
};

afterEach(() => {
  process.env.EXPO_PUBLIC_TIME2PAY_DATA_MODE = ORIGINAL_ENV.EXPO_PUBLIC_TIME2PAY_DATA_MODE;
  process.env.EXPO_PUBLIC_SITE_ORIGIN = ORIGINAL_ENV.EXPO_PUBLIC_SITE_ORIGIN;
  process.env.EXPO_PUBLIC_SUPABASE_URL = ORIGINAL_ENV.EXPO_PUBLIC_SUPABASE_URL;
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = ORIGINAL_ENV.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  Reflect.deleteProperty(globalThis, 'window');
  vi.restoreAllMocks();
});

describe('resolveSupabaseAuthRedirectUrl', () => {
  it('uses the current loopback browser origin in hosted mode during local testing', () => {
    process.env.EXPO_PUBLIC_TIME2PAY_DATA_MODE = 'hosted';
    process.env.EXPO_PUBLIC_SITE_ORIGIN = 'https://time2pay.app';
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon';
    (globalThis as Record<string, unknown>).window = { location: { origin: 'http://localhost:8081' } };

    expect(resolveSupabaseAuthRedirectUrl()).toBe('http://localhost:8081/dashboard');
  });

  it('keeps the configured site origin in hosted mode for non-local browser origins', () => {
    process.env.EXPO_PUBLIC_TIME2PAY_DATA_MODE = 'hosted';
    process.env.EXPO_PUBLIC_SITE_ORIGIN = 'https://time2pay.app';
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon';
    (globalThis as Record<string, unknown>).window = {
      location: { origin: 'https://preview.time2pay.app' },
    };

    expect(resolveSupabaseAuthRedirectUrl()).toBe('https://time2pay.app/dashboard');
  });

  it('builds redirect URL from current origin in local mode', () => {
    process.env.EXPO_PUBLIC_TIME2PAY_DATA_MODE = 'local';
    (globalThis as Record<string, unknown>).window = { location: { origin: 'http://localhost:3000' } };

    expect(resolveSupabaseAuthRedirectUrl()).toBe('http://localhost:3000/dashboard');
  });

  it('returns undefined when local mode runs server-side', () => {
    process.env.EXPO_PUBLIC_TIME2PAY_DATA_MODE = 'local';

    expect(resolveSupabaseAuthRedirectUrl()).toBeUndefined();
  });

  it('throws when hosted mode is missing the required site origin', () => {
    process.env.EXPO_PUBLIC_TIME2PAY_DATA_MODE = 'hosted';
    process.env.EXPO_PUBLIC_SITE_ORIGIN = '';
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon';

    expect(() => resolveSupabaseAuthRedirectUrl()).toThrow(
      'Hosted mode requires environment variables: EXPO_PUBLIC_SITE_ORIGIN',
    );
  });
});
