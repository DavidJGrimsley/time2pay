import { useAuthUiStore } from '@/stores/auth-ui-store';
import { readTrimmedPublicRuntimeConfigValue } from '@/services/runtime-config';

export type Time2PayDataMode = 'local' | 'hosted';
export type AppAccessMode = 'local' | 'hosted' | 'tour';

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

export function assertHostedModeConfigured(): void {
  if (!isHostedMode()) {
    return;
  }

  const missing: string[] = [];
  if (!readTrimmedPublicRuntimeConfigValue('EXPO_PUBLIC_SUPABASE_URL')) {
    missing.push('EXPO_PUBLIC_SUPABASE_URL');
  }

  const supabaseAnonKey = readTrimmedPublicRuntimeConfigValue('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  if (!supabaseAnonKey) {
    missing.push('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  }

  if (missing.length > 0) {
    throw new Error(`Hosted mode requires environment variables: ${missing.join(', ')}`);
  }
}
