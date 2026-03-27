import { afterEach, describe, expect, it } from 'vitest';
import { resolveSiteOrigin } from '@/services/site-origin';

const ORIGINAL_ENV = {
  EXPO_PUBLIC_SITE_ORIGIN: process.env.EXPO_PUBLIC_SITE_ORIGIN,
};

afterEach(() => {
  process.env.EXPO_PUBLIC_SITE_ORIGIN = ORIGINAL_ENV.EXPO_PUBLIC_SITE_ORIGIN;
  Reflect.deleteProperty(globalThis, 'window');
});

describe('site-origin', () => {
  it('prefers the configured public site origin', () => {
    process.env.EXPO_PUBLIC_SITE_ORIGIN = 'https://staging.time2pay.app/';
    (globalThis as Record<string, unknown>).window = {
      location: { origin: 'http://localhost:3000' },
    };

    expect(resolveSiteOrigin()).toBe('https://staging.time2pay.app');
  });

  it('falls back to the current window origin when the env var is missing', () => {
    process.env.EXPO_PUBLIC_SITE_ORIGIN = '';
    (globalThis as Record<string, unknown>).window = {
      location: { origin: 'http://localhost:3000' },
    };

    expect(resolveSiteOrigin()).toBe('http://localhost:3000');
  });

  it('uses the production origin fallback when no explicit origin is available', () => {
    process.env.EXPO_PUBLIC_SITE_ORIGIN = '';

    expect(resolveSiteOrigin()).toBe('https://time2pay.app');
  });
});
