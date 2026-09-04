import { afterEach, describe, expect, it } from 'vitest';
import {
  normalizeHostedWriteError,
  resolveHostedWriteUrl,
} from '@/database/hosted/shared/runtime';
import {
  requireConfiguredSiteOrigin,
  resolveBrowserSiteOrigin,
  resolveSiteOrigin,
} from '@/services/site-origin';

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

  it('prefers the current loopback browser origin for local web testing', () => {
    process.env.EXPO_PUBLIC_SITE_ORIGIN = 'https://staging.time2pay.app/';
    (globalThis as Record<string, unknown>).window = {
      location: { origin: 'http://localhost:8081' },
    };

    expect(resolveBrowserSiteOrigin()).toBe('http://localhost:8081');
  });

  it('keeps the configured site origin for non-local browser origins', () => {
    process.env.EXPO_PUBLIC_SITE_ORIGIN = 'https://time2pay.app/';
    (globalThis as Record<string, unknown>).window = {
      location: { origin: 'https://preview.time2pay.app' },
    };

    expect(resolveBrowserSiteOrigin()).toBe('https://time2pay.app');
  });

  it('uses the active local browser origin for hosted writes instead of forcing the configured origin', () => {
    process.env.EXPO_PUBLIC_SITE_ORIGIN = 'https://staging.time2pay.app/';
    (globalThis as Record<string, unknown>).window = {
      location: { origin: 'http://localhost:8082' },
    };

    expect(resolveHostedWriteUrl('/api/db/sessions/start')).toBe(
      'http://localhost:8082/api/db/sessions/start',
    );
  });

  it('falls back to the current window origin when the env var is missing', () => {
    process.env.EXPO_PUBLIC_SITE_ORIGIN = '';
    (globalThis as Record<string, unknown>).window = {
      location: { origin: 'http://localhost:3000' },
    };

    expect(resolveSiteOrigin()).toBe('http://localhost:3000');
    expect(resolveBrowserSiteOrigin()).toBe('http://localhost:3000');
  });

  it('uses the production origin fallback when no explicit origin is available', () => {
    process.env.EXPO_PUBLIC_SITE_ORIGIN = '';

    expect(resolveSiteOrigin()).toBe('https://time2pay.app');
  });

  it('throws when required site origin is missing', () => {
    process.env.EXPO_PUBLIC_SITE_ORIGIN = '';

    expect(() => requireConfiguredSiteOrigin()).toThrow(
      'Hosted mode requires EXPO_PUBLIC_SITE_ORIGIN.',
    );
  });

  it('throws when required site origin is invalid', () => {
    process.env.EXPO_PUBLIC_SITE_ORIGIN = 'not-a-url';

    expect(() => requireConfiguredSiteOrigin()).toThrow(
      'EXPO_PUBLIC_SITE_ORIGIN must be a valid absolute URL.',
    );
  });

  it('turns raw stack traces into a user-friendly write error', () => {
    expect(
      normalizeHostedWriteError('TypeError: Cannot read properties of undefined (reading \'action\')'),
    ).toBe('We couldn’t save this change. Please refresh and try again.');
  });
});
