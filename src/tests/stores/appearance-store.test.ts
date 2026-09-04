import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  setTheme: vi.fn(),
  storage: new Map<string, string>(),
}));

vi.mock('uniwind', () => ({
  Uniwind: { setTheme: mocks.setTheme },
}));

vi.mock('@/services/browser-storage', () => ({
  readLocalStorageItem: (key: string) => mocks.storage.get(key) ?? null,
  writeLocalStorageItem: (key: string, value: string) => {
    mocks.storage.set(key, value);
    return true;
  },
}));

describe('appearance-store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.storage.clear();
  });

  it('defaults to system when nothing is stored', async () => {
    const { readStoredAppearancePreference } = await import('@/stores/appearance-store');
    expect(readStoredAppearancePreference()).toBe('system');
  });

  it('ignores an invalid stored value and falls back to system', async () => {
    mocks.storage.set('time2pay.settings.appearance-preference', 'not-a-real-theme');
    const { readStoredAppearancePreference } = await import('@/stores/appearance-store');
    expect(readStoredAppearancePreference()).toBe('system');
  });

  it('persists and applies a new preference', async () => {
    const { useAppearanceUiStore } = await import('@/stores/appearance-store');

    useAppearanceUiStore.getState().setAppearancePreference('dark');

    expect(mocks.setTheme).toHaveBeenCalledWith('dark');
    expect(mocks.storage.get('time2pay.settings.appearance-preference')).toBe('dark');
    expect(useAppearanceUiStore.getState().appearancePreference).toBe('dark');
  });

  it('hydrates from storage and applies the theme', async () => {
    mocks.storage.set('time2pay.settings.appearance-preference', 'light');
    const { useAppearanceUiStore } = await import('@/stores/appearance-store');

    useAppearanceUiStore.getState().hydrateAppearancePreference();

    expect(mocks.setTheme).toHaveBeenCalledWith('light');
    expect(useAppearanceUiStore.getState().appearancePreference).toBe('light');
  });
});
