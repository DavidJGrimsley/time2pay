import { useAuthUiStore } from '@/stores/auth-ui-store';
import { readTrimmedPublicRuntimeConfigValue } from '@/services/runtime-config';
import { requireConfiguredSiteOrigin } from '@/services/site-origin';

export type Time2PayDataMode = 'local' | 'hosted';
export type AppAccessMode = 'local' | 'hosted' | 'tour';
export type HostedModeRequiredPublicEnvKey =
  | 'EXPO_PUBLIC_SITE_ORIGIN'
  | 'EXPO_PUBLIC_SUPABASE_URL'
  | 'EXPO_PUBLIC_SUPABASE_ANON_KEY';
export type HostedModeDeprecatedPublicEnvKey =
  | 'EXPO_PUBLIC_HOSTED_API_BASE_URL'
  | 'EXPO_PUBLIC_SUPABASE_AUTH_REDIRECT_URL'
  | 'EXPO_PUBLIC_SUPABASE_AUTH_REDIRECT_PATH'
  | 'EXPO_PUBLIC_MERCURY_PROXY_PATH'
  | 'SITE_ORIGIN';

export const HOSTED_MODE_REQUIRED_PUBLIC_ENV_KEYS: readonly HostedModeRequiredPublicEnvKey[] = [
  'EXPO_PUBLIC_SITE_ORIGIN',
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
];
export const HOSTED_MODE_DEPRECATED_PUBLIC_ENV_KEYS: readonly HostedModeDeprecatedPublicEnvKey[] = [
  'EXPO_PUBLIC_HOSTED_API_BASE_URL',
  'EXPO_PUBLIC_SUPABASE_AUTH_REDIRECT_URL',
  'EXPO_PUBLIC_SUPABASE_AUTH_REDIRECT_PATH',
  'EXPO_PUBLIC_MERCURY_PROXY_PATH',
  'SITE_ORIGIN',
];

export function getDataMode(): Time2PayDataMode {
  const mode = readTrimmedPublicRuntimeConfigValue('EXPO_PUBLIC_TIME2PAY_DATA_MODE').toLowerCase();
  return mode === 'hosted' ? 'hosted' : 'local';
}

export function resolveAppAccessMode(
  dataMode: Time2PayDataMode,
  tourModeEnabled: boolean,
): AppAccessMode {
  if (dataMode !== 'hosted') {
    return 'local';
  }

  return tourModeEnabled ? 'tour' : 'hosted';
}

export function getAppAccessMode(): AppAccessMode {
  return resolveAppAccessMode(getDataMode(), useAuthUiStore.getState().tourModeEnabled);
}

export function isHostedMode(): boolean {
  return getDataMode() === 'hosted';
}

export function isTourMode(): boolean {
  return getAppAccessMode() === 'tour';
}

export function usesHostedData(): boolean {
  return getAppAccessMode() === 'hosted';
}

export function getMissingHostedModePublicEnvKeys(): HostedModeRequiredPublicEnvKey[] {
  if (!isHostedMode()) {
    return [];
  }

  return HOSTED_MODE_REQUIRED_PUBLIC_ENV_KEYS.filter(
    (key) => !readTrimmedPublicRuntimeConfigValue(key),
  );
}

export function getPresentHostedModeDeprecatedPublicEnvKeys(): HostedModeDeprecatedPublicEnvKey[] {
  if (!isHostedMode()) {
    return [];
  }

  return HOSTED_MODE_DEPRECATED_PUBLIC_ENV_KEYS.filter(
    (key) => Boolean(process.env[key]?.trim()),
  );
}

export function assertHostedModeConfigured(): void {
  const missing = getMissingHostedModePublicEnvKeys();

  if (missing.length > 0) {
    throw new Error(`Hosted mode requires environment variables: ${missing.join(', ')}`);
  }

  const deprecated = getPresentHostedModeDeprecatedPublicEnvKeys();
  if (deprecated.length > 0) {
    throw new Error(
      `Hosted mode no longer supports deprecated environment variables: ${deprecated.join(', ')}`,
    );
  }

  requireConfiguredSiteOrigin();
}
