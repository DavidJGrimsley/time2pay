import { Uniwind } from 'uniwind';
import { create } from 'zustand';
import { readLocalStorageItem, writeLocalStorageItem } from '@/services/browser-storage';

export type AppearancePreference = 'light' | 'dark' | 'system';

export const APPEARANCE_STORAGE_KEY = 'time2pay.settings.appearance-preference';
const VALID_PREFERENCES: AppearancePreference[] = ['light', 'dark', 'system'];

function isAppearancePreference(value: string | null): value is AppearancePreference {
  return value !== null && (VALID_PREFERENCES as string[]).includes(value);
}

export function readStoredAppearancePreference(): AppearancePreference {
  const stored = readLocalStorageItem(APPEARANCE_STORAGE_KEY);
  return isAppearancePreference(stored) ? stored : 'system';
}

function applyAppearancePreference(preference: AppearancePreference): void {
  try {
    Uniwind.setTheme(preference);
  } catch {
    // no-op: Uniwind is unavailable in this environment (e.g. some test setups).
  }
}

type AppearanceUiState = {
  appearancePreference: AppearancePreference;
  hydrateAppearancePreference: () => void;
  setAppearancePreference: (preference: AppearancePreference) => void;
};

export const useAppearanceUiStore = create<AppearanceUiState>((set) => ({
  appearancePreference: 'system',
  hydrateAppearancePreference: () => {
    const stored = readStoredAppearancePreference();
    applyAppearancePreference(stored);
    set({ appearancePreference: stored });
  },
  setAppearancePreference: (preference) => {
    writeLocalStorageItem(APPEARANCE_STORAGE_KEY, preference);
    applyAppearancePreference(preference);
    set({ appearancePreference: preference });
  },
}));
