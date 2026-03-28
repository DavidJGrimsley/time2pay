import { readTrimmedPublicRuntimeConfigValue } from '@/services/runtime-config';

const DEFAULT_SITE_ORIGIN = 'https://time2pay.app';

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function parseAbsoluteSiteOrigin(rawOrigin: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawOrigin);
  } catch {
    throw new Error('EXPO_PUBLIC_SITE_ORIGIN must be a valid absolute URL.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('EXPO_PUBLIC_SITE_ORIGIN must use http:// or https://.');
  }

  return trimTrailingSlash(parsed.origin);
}

export function requireConfiguredSiteOrigin(): string {
  const configuredOrigin = readTrimmedPublicRuntimeConfigValue('EXPO_PUBLIC_SITE_ORIGIN');
  if (!configuredOrigin) {
    throw new Error('Hosted mode requires EXPO_PUBLIC_SITE_ORIGIN.');
  }

  return parseAbsoluteSiteOrigin(configuredOrigin);
}

export function resolveSiteOrigin(): string {
  const configuredOrigin = readTrimmedPublicRuntimeConfigValue('EXPO_PUBLIC_SITE_ORIGIN');
  const explicitOrigin = configuredOrigin ? parseAbsoluteSiteOrigin(configuredOrigin) : '';
  if (explicitOrigin) {
    return explicitOrigin;
  }

  if (typeof window !== 'undefined' && typeof window.location?.origin === 'string') {
    const runtimeOrigin = trimTrailingSlash(window.location.origin.trim());
    if (runtimeOrigin) {
      return runtimeOrigin;
    }
  }

  return DEFAULT_SITE_ORIGIN;
}
