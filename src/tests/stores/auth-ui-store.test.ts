import { beforeEach, describe, expect, it } from 'vitest';

import { useAuthUiStore } from '@/stores/auth-ui-store';

const initialState = useAuthUiStore.getInitialState();

describe('useAuthUiStore hosted access gate', () => {
  beforeEach(() => {
    useAuthUiStore.setState(initialState, true);
  });

  it('keeps an active local tour instead of treating the user as signed in', () => {
    useAuthUiStore.getState().startTour();
    useAuthUiStore.getState().resetForLocalMode();

    const state = useAuthUiStore.getState();
    expect(state.tourModeEnabled).toBe(true);
    expect(state.isAuthenticated).toBe(false);
  });

  it('records hosted access check errors without enabling paywall enforcement', () => {
    useAuthUiStore.getState().setHostedAccessGateError('Network failed.');

    const state = useAuthUiStore.getState();

    expect(state.hostedAccessGateReady).toBe(true);
    expect(state.hostedAccessGateStatus).toBe('error');
    expect(state.hostedAccessEnforcementEnabled).toBe(false);
    expect(state.hostedAccessHasAccess).toBeNull();
    expect(state.hostedAccessGateError).toBe('Network failed.');
  });
});
