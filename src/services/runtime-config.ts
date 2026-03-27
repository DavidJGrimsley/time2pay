const PUBLIC_RUNTIME_ENV_KEYS = [
  'EXPO_PUBLIC_GITHUB_CLIENT_ID',
  'EXPO_PUBLIC_HOSTED_API_BASE_URL',
  'EXPO_PUBLIC_MERCURY_PROXY_PATH',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_SUPABASE_AUTH_REDIRECT_PATH',
  'EXPO_PUBLIC_SUPABASE_AUTH_REDIRECT_URL',
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_TIME2PAY_DATA_MODE',
] as const;

export type PublicRuntimeEnvKey = (typeof PUBLIC_RUNTIME_ENV_KEYS)[number];

type PublicRuntimeConfig = Partial<Record<PublicRuntimeEnvKey, string>>;

declare global {
  interface Window {
    __TIME2PAY_RUNTIME_CONFIG__?: PublicRuntimeConfig;
  }
}

function readBuildTimePublicRuntimeValue(key: PublicRuntimeEnvKey): string {
  switch (key) {
    case 'EXPO_PUBLIC_GITHUB_CLIENT_ID':
      return process.env.EXPO_PUBLIC_GITHUB_CLIENT_ID ?? '';
    case 'EXPO_PUBLIC_HOSTED_API_BASE_URL':
      return process.env.EXPO_PUBLIC_HOSTED_API_BASE_URL ?? '';
    case 'EXPO_PUBLIC_MERCURY_PROXY_PATH':
      return process.env.EXPO_PUBLIC_MERCURY_PROXY_PATH ?? '';
    case 'EXPO_PUBLIC_SUPABASE_ANON_KEY':
      return process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
    case 'EXPO_PUBLIC_SUPABASE_AUTH_REDIRECT_PATH':
      return process.env.EXPO_PUBLIC_SUPABASE_AUTH_REDIRECT_PATH ?? '';
    case 'EXPO_PUBLIC_SUPABASE_AUTH_REDIRECT_URL':
      return process.env.EXPO_PUBLIC_SUPABASE_AUTH_REDIRECT_URL ?? '';
    case 'EXPO_PUBLIC_SUPABASE_URL':
      return process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
    case 'EXPO_PUBLIC_TIME2PAY_DATA_MODE':
      return process.env.EXPO_PUBLIC_TIME2PAY_DATA_MODE ?? '';
    default:
      return '';
  }
}

function readWindowRuntimeConfig(): PublicRuntimeConfig | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const runtimeConfig = window.__TIME2PAY_RUNTIME_CONFIG__;
  if (!runtimeConfig || typeof runtimeConfig !== 'object' || Array.isArray(runtimeConfig)) {
    return null;
  }

  return runtimeConfig;
}

export function readPublicRuntimeConfigValue(key: PublicRuntimeEnvKey): string {
  const runtimeConfig = readWindowRuntimeConfig();
  const runtimeValue = runtimeConfig?.[key];

  if (typeof runtimeValue === 'string') {
    return runtimeValue;
  }

  return readBuildTimePublicRuntimeValue(key);
}

export function readTrimmedPublicRuntimeConfigValue(key: PublicRuntimeEnvKey): string {
  return readPublicRuntimeConfigValue(key).trim();
}

export function getPublicRuntimeEnvKeys(): readonly PublicRuntimeEnvKey[] {
  return PUBLIC_RUNTIME_ENV_KEYS;
}
