import { readTrimmedPublicRuntimeConfigValue } from '@/services/runtime-config';

const DEFAULT_SITE_ORIGIN = 'https://time2pay.app';

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

export function resolveSiteOrigin(): string {
  const explicitOrigin = trimTrailingSlash(readTrimmedPublicRuntimeConfigValue('EXPO_PUBLIC_SITE_ORIGIN'));
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
