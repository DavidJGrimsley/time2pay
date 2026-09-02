import { create } from 'zustand';
import {
  readLocalStorageItem,
  removeLocalStorageItem,
  writeLocalStorageItem,
} from '@/services/browser-storage';
import type { HostedOnboardingGateStatus } from '@/database/hosted/onboarding';
import type { HostedAccessGateStatus } from '@/features/onboarding/onboarding-route-gate';

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

type HostedOnboardingSnapshot = {
  status: HostedOnboardingGateStatus;
  completedStepIds: string[];
  missingLegalDocumentIds: string[];
};

type HostedAccessSnapshot = {
  enforcementEnabled: boolean;
  hasAccess: boolean | null;
  status: HostedAccessGateStatus;
};

type AuthUiState = {
  authReady: boolean;
  isAuthenticated: boolean;
  onboardingGateReady: boolean;
  onboardingGateStatus: HostedOnboardingGateStatus | 'checking' | 'error';
  completedOnboardingStepIds: string[];
  missingLegalDocumentIds: string[];
  onboardingGateError: string | null;
  hostedAccessGateReady: boolean;
  hostedAccessGateStatus: HostedAccessGateStatus;
  hostedAccessEnforcementEnabled: boolean;
  hostedAccessHasAccess: boolean | null;
  hostedAccessGateError: string | null;
  tourModeEnabled: boolean;
  tourModeHydrated: boolean;
  tourInitError: string | null;
  hydrateTourMode: () => void;
  setAuthReady: (ready: boolean) => void;
  setAuthenticated: (authenticated: boolean) => void;
  setOnboardingGateChecking: () => void;
  syncOnboardingGate: (snapshot: HostedOnboardingSnapshot) => void;
  setOnboardingGateError: (message: string) => void;
  resetOnboardingGate: () => void;
  setHostedAccessGateChecking: () => void;
  syncHostedAccessGate: (snapshot: HostedAccessSnapshot) => void;
  setHostedAccessGateError: (message: string) => void;
  resetHostedAccessGate: () => void;
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
  onboardingGateReady: false,
  onboardingGateStatus: 'checking',
  completedOnboardingStepIds: [],
  missingLegalDocumentIds: [],
  onboardingGateError: null,
  hostedAccessGateReady: false,
  hostedAccessGateStatus: 'checking',
  hostedAccessEnforcementEnabled: false,
  hostedAccessHasAccess: null,
  hostedAccessGateError: null,
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
        onboardingGateReady: authenticated ? state.onboardingGateReady : false,
        onboardingGateStatus: authenticated ? state.onboardingGateStatus : 'checking',
        completedOnboardingStepIds: authenticated ? state.completedOnboardingStepIds : [],
        missingLegalDocumentIds: authenticated ? state.missingLegalDocumentIds : [],
        onboardingGateError: authenticated ? state.onboardingGateError : null,
        hostedAccessGateReady: authenticated ? state.hostedAccessGateReady : false,
        hostedAccessGateStatus: authenticated ? state.hostedAccessGateStatus : 'checking',
        hostedAccessEnforcementEnabled: authenticated ? state.hostedAccessEnforcementEnabled : false,
        hostedAccessHasAccess: authenticated ? state.hostedAccessHasAccess : null,
        hostedAccessGateError: authenticated ? state.hostedAccessGateError : null,
      };
    }),
  setOnboardingGateChecking: () =>
    set({
      onboardingGateReady: false,
      onboardingGateStatus: 'checking',
      onboardingGateError: null,
    }),
  syncOnboardingGate: (snapshot) =>
    set({
      onboardingGateReady: true,
      onboardingGateStatus: snapshot.status,
      completedOnboardingStepIds: snapshot.completedStepIds,
      missingLegalDocumentIds: snapshot.missingLegalDocumentIds,
      onboardingGateError: null,
    }),
  setOnboardingGateError: (message) =>
    set({
      onboardingGateReady: true,
      onboardingGateStatus: 'error',
      onboardingGateError: message,
    }),
  resetOnboardingGate: () =>
    set({
      onboardingGateReady: false,
      onboardingGateStatus: 'checking',
      completedOnboardingStepIds: [],
      missingLegalDocumentIds: [],
      onboardingGateError: null,
    }),
  setHostedAccessGateChecking: () =>
    set({
      hostedAccessGateReady: false,
      hostedAccessGateStatus: 'checking',
      hostedAccessEnforcementEnabled: false,
      hostedAccessHasAccess: null,
      hostedAccessGateError: null,
    }),
  syncHostedAccessGate: (snapshot) =>
    set({
      hostedAccessGateReady: true,
      hostedAccessGateStatus: snapshot.status,
      hostedAccessEnforcementEnabled: snapshot.enforcementEnabled,
      hostedAccessHasAccess: snapshot.hasAccess,
      hostedAccessGateError: null,
    }),
  setHostedAccessGateError: (message) =>
    set({
      hostedAccessGateReady: true,
      hostedAccessGateStatus: 'error',
      hostedAccessEnforcementEnabled: false,
      hostedAccessHasAccess: null,
      hostedAccessGateError: message,
    }),
  resetHostedAccessGate: () =>
    set({
      hostedAccessGateReady: false,
      hostedAccessGateStatus: 'checking',
      hostedAccessEnforcementEnabled: false,
      hostedAccessHasAccess: null,
      hostedAccessGateError: null,
    }),
  setTourModeEnabled: (enabled) =>
    set(() => {
      persistTourMode(enabled);
      return {
        hostedAccessGateReady: false,
        hostedAccessGateStatus: 'checking',
        hostedAccessEnforcementEnabled: false,
        hostedAccessHasAccess: null,
        hostedAccessGateError: null,
        tourModeEnabled: enabled,
        tourModeHydrated: true,
        tourInitError: null,
      };
    }),
  setTourInitError: (message) => set({ tourInitError: message }),
  startTour: () =>
    set(() => {
      persistTourMode(true);
      return {
        tourModeEnabled: true,
        tourModeHydrated: true,
        tourInitError: null,
        onboardingGateReady: false,
        onboardingGateStatus: 'checking',
        onboardingGateError: null,
        hostedAccessGateReady: false,
        hostedAccessGateStatus: 'checking',
        hostedAccessEnforcementEnabled: false,
        hostedAccessHasAccess: null,
        hostedAccessGateError: null,
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
        onboardingGateReady: authenticated ? state.onboardingGateReady : false,
        onboardingGateStatus: authenticated ? state.onboardingGateStatus : 'checking',
        completedOnboardingStepIds: authenticated ? state.completedOnboardingStepIds : [],
        missingLegalDocumentIds: authenticated ? state.missingLegalDocumentIds : [],
        onboardingGateError: authenticated ? state.onboardingGateError : null,
        hostedAccessGateReady: authenticated ? state.hostedAccessGateReady : false,
        hostedAccessGateStatus: authenticated ? state.hostedAccessGateStatus : 'checking',
        hostedAccessEnforcementEnabled: authenticated ? state.hostedAccessEnforcementEnabled : false,
        hostedAccessHasAccess: authenticated ? state.hostedAccessHasAccess : null,
        hostedAccessGateError: authenticated ? state.hostedAccessGateError : null,
      };
    }),
  resetForLocalMode: () =>
    set((state) => {
      const keepTour = state.tourModeEnabled || loadPersistedTourMode();
      persistTourMode(keepTour);
      return {
        authReady: true,
        isAuthenticated: !keepTour,
        onboardingGateReady: true,
        onboardingGateStatus: 'complete',
        completedOnboardingStepIds: [],
        missingLegalDocumentIds: [],
        onboardingGateError: null,
        hostedAccessGateReady: true,
        hostedAccessGateStatus: 'allowed',
        hostedAccessEnforcementEnabled: false,
        hostedAccessHasAccess: true,
        hostedAccessGateError: null,
        tourModeEnabled: keepTour,
        tourModeHydrated: true,
        tourInitError: keepTour ? state.tourInitError : null,
      };
    }),
}));

