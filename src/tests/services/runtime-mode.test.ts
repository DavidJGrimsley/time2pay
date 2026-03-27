import { afterEach, describe, expect, it } from 'vitest';
import { getDataMode, getMissingHostedModePublicEnvKeys } from '@/services/runtime-mode';

const ORIGINAL_ENV = {
  EXPO_PUBLIC_TIME2PAY_DATA_MODE: process.env.EXPO_PUBLIC_TIME2PAY_DATA_MODE,
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
};

afterEach(() => {
  process.env.EXPO_PUBLIC_TIME2PAY_DATA_MODE = ORIGINAL_ENV.EXPO_PUBLIC_TIME2PAY_DATA_MODE;
  process.env.EXPO_PUBLIC_SUPABASE_URL = ORIGINAL_ENV.EXPO_PUBLIC_SUPABASE_URL;
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = ORIGINAL_ENV.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  Reflect.deleteProperty(globalThis, 'window');
});

describe('runtime-mode hosted env diagnostics', () => {
  it('returns local mode by default', () => {
    process.env.EXPO_PUBLIC_TIME2PAY_DATA_MODE = '';

    expect(getDataMode()).toBe('local');
    expect(getMissingHostedModePublicEnvKeys()).toEqual([]);
  });

  it('reports missing hosted keys when hosted mode is enabled', () => {
    process.env.EXPO_PUBLIC_TIME2PAY_DATA_MODE = 'hosted';
    process.env.EXPO_PUBLIC_SUPABASE_URL = '';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon';

    expect(getDataMode()).toBe('hosted');
    expect(getMissingHostedModePublicEnvKeys()).toEqual(['EXPO_PUBLIC_SUPABASE_URL']);
  });

  it('uses runtime-injected config values when available', () => {
    process.env.EXPO_PUBLIC_TIME2PAY_DATA_MODE = 'local';
    process.env.EXPO_PUBLIC_SUPABASE_URL = '';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = '';
    (globalThis as Record<string, unknown>).window = {
      __TIME2PAY_RUNTIME_CONFIG__: {
        EXPO_PUBLIC_TIME2PAY_DATA_MODE: 'hosted',
        EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
        EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
      },
    };

    expect(getDataMode()).toBe('hosted');
    expect(getMissingHostedModePublicEnvKeys()).toEqual([]);
  });
});
