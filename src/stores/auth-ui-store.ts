import { create } from 'zustand';

type HostedAuthSnapshot = {
  ready: boolean;
  authenticated: boolean;
};

type AuthUiState = {
  authReady: boolean;
  isAuthenticated: boolean;
  tourModeEnabled: boolean;
  setAuthReady: (ready: boolean) => void;
  setAuthenticated: (authenticated: boolean) => void;
  setTourModeEnabled: (enabled: boolean) => void;
  startTour: () => void;
  endTour: () => void;
  syncHostedAuth: (snapshot: HostedAuthSnapshot) => void;
  resetForLocalMode: () => void;
};

export const useAuthUiStore = create<AuthUiState>((set) => ({
  authReady: false,
  isAuthenticated: false,
  tourModeEnabled: false,
  setAuthReady: (ready) => set({ authReady: ready }),
  setAuthenticated: (authenticated) =>
    set((state) => ({
      isAuthenticated: authenticated,
      tourModeEnabled: authenticated ? false : state.tourModeEnabled,
    })),
  setTourModeEnabled: (enabled) => set({ tourModeEnabled: enabled }),
  startTour: () => set({ tourModeEnabled: true }),
  endTour: () => set({ tourModeEnabled: false }),
  syncHostedAuth: ({ ready, authenticated }) =>
    set((state) => ({
      authReady: ready,
      isAuthenticated: authenticated,
      tourModeEnabled: authenticated ? false : state.tourModeEnabled,
    })),
  resetForLocalMode: () =>
    set({
      authReady: true,
      isAuthenticated: true,
      tourModeEnabled: false,
    }),
}));

