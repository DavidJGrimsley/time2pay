import { create } from 'zustand';
import {
  readLocalStorageItem,
  removeLocalStorageItem,
  writeLocalStorageItem,
} from '@/services/browser-storage';

const TOUR_MODE_STORAGE_KEY = 'time2pay.auth.tour-mode-enabled';

function loadPersistedTourMode(): boolean {
  return readLocalStorageItem(TOUR_MODE_STORAGE_KEY) === '1';
}

function persistTourMode(enabled: boolean): void {
  if (enabled) {
    writeLocalStorageItem(TOUR_MODE_STORAGE_KEY, '1');
    return;
  }

  removeLocalStorageItem(TOUR_MODE_STORAGE_KEY);
}

type HostedAuthSnapshot = {
  ready: boolean;
  authenticated: boolean;
};

type AuthUiState = {
  authReady: boolean;
  isAuthenticated: boolean;
  tourModeEnabled: boolean;
  tourModeHydrated: boolean;
  tourInitError: string | null;
  hydrateTourMode: () => void;
  setAuthReady: (ready: boolean) => void;
  setAuthenticated: (authenticated: boolean) => void;
  setTourModeEnabled: (enabled: boolean) => void;
  setTourInitError: (message: string | null) => void;
  startTour: () => void;
  endTour: () => void;
  syncHostedAuth: (snapshot: HostedAuthSnapshot) => void;
  resetForLocalMode: () => void;
};

export const useAuthUiStore = create<AuthUiState>((set) => ({
  authReady: false,
  isAuthenticated: false,
  tourModeEnabled: false,
  tourModeHydrated: false,
  tourInitError: null,
  hydrateTourMode: () =>
    set((state) => {
      if (state.tourModeHydrated) {
        return state;
      }

      return {
        tourModeEnabled: loadPersistedTourMode(),
        tourModeHydrated: true,
      };
    }),
  setAuthReady: (ready) => set({ authReady: ready }),
  setAuthenticated: (authenticated) =>
    set((state) => {
      const nextTourModeEnabled = authenticated ? false : state.tourModeEnabled;
      persistTourMode(nextTourModeEnabled);

      return {
        isAuthenticated: authenticated,
        tourModeEnabled: nextTourModeEnabled,
      };
    }),
  setTourModeEnabled: (enabled) =>
    set(() => {
      persistTourMode(enabled);
      return { tourModeEnabled: enabled, tourModeHydrated: true, tourInitError: null };
    }),
  setTourInitError: (message) => set({ tourInitError: message }),
  startTour: () =>
    set(() => {
      persistTourMode(true);
      return {
        tourModeEnabled: true,
        tourModeHydrated: true,
        tourInitError: null,
        authReady: true,
        isAuthenticated: false,
      };
    }),
  endTour: () =>
    set(() => {
      persistTourMode(false);
      return { tourModeEnabled: false, tourModeHydrated: true, tourInitError: null };
    }),
  syncHostedAuth: ({ ready, authenticated }) =>
    set((state) => {
      const nextTourModeEnabled = authenticated ? false : state.tourModeEnabled;
      persistTourMode(nextTourModeEnabled);

      return {
        authReady: ready,
        isAuthenticated: authenticated,
        tourModeEnabled: nextTourModeEnabled,
        tourModeHydrated: true,
        tourInitError: authenticated ? null : state.tourInitError,
      };
    }),
  resetForLocalMode: () =>
    set(() => {
      persistTourMode(false);
      return {
        authReady: true,
        isAuthenticated: true,
        tourModeEnabled: false,
        tourModeHydrated: true,
        tourInitError: null,
      };
    }),
}));

