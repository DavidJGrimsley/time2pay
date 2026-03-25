import { useAuthUiStore } from '@/stores/auth-ui-store';

export type Time2PayDataMode = 'local' | 'hosted';
export type AppAccessMode = 'local' | 'hosted' | 'tour';

export function getDataMode(): Time2PayDataMode {
  const mode = process.env.EXPO_PUBLIC_TIME2PAY_DATA_MODE?.trim().toLowerCase();
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
  if (!process.env.EXPO_PUBLIC_SUPABASE_URL?.trim()) {
    missing.push('EXPO_PUBLIC_SUPABASE_URL');
  }

  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';
  if (!supabaseAnonKey) {
    missing.push('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  }

  if (missing.length > 0) {
    throw new Error(`Hosted mode requires environment variables: ${missing.join(', ')}`);
  }
}
