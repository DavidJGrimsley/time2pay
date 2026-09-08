import type { Time2PayLogoState, Time2PayStableLogoState } from './time2pay-logo-motion';

export type TimerLogoAction = 'clock-in' | 'pause' | 'resume' | 'clock-out';

export type TimerLogoControllerState = {
  phase: Time2PayLogoState;
  previousStableState: Time2PayStableLogoState;
  pendingAction: TimerLogoAction | null;
  isTransitioning: boolean;
};

export type TimerLogoControllerEvent =
  | { type: 'sync'; stableState: Time2PayStableLogoState }
  | { type: 'start'; action: TimerLogoAction }
  | { type: 'succeed'; action: TimerLogoAction }
  | { type: 'fail'; action: TimerLogoAction }
  | { type: 'animation-complete'; phase: Time2PayLogoState }
  | { type: 'reset'; stableState: Time2PayStableLogoState };

const PENDING_PHASES: Record<TimerLogoAction, Time2PayLogoState> = {
  'clock-in': 'clocking-in',
  pause: 'pausing',
  resume: 'resuming',
  'clock-out': 'clocking-out',
};

const SUCCESS_PHASES: Record<TimerLogoAction, Time2PayLogoState> = {
  'clock-in': 'clock-in-success',
  pause: 'pause-success',
  resume: 'resume-success',
  'clock-out': 'clock-out-success',
};

const SUCCESS_STABLE_PHASES: Record<TimerLogoAction, Time2PayStableLogoState> = {
  'clock-in': 'clocked-in-idle',
  pause: 'paused-idle',
  resume: 'clocked-in-idle',
  'clock-out': 'clocked-out-idle',
};

export function createTimerLogoControllerState(stableState: Time2PayStableLogoState): TimerLogoControllerState {
  return {
    phase: stableState,
    previousStableState: stableState,
    pendingAction: null,
    isTransitioning: false,
  };
}

export function timerLogoReducer(
  state: TimerLogoControllerState,
  event: TimerLogoControllerEvent,
): TimerLogoControllerState {
  switch (event.type) {
    case 'sync':
      if (state.isTransitioning || state.phase === event.stableState) return state;
      return createTimerLogoControllerState(event.stableState);
    case 'start':
      if (state.isTransitioning) return state;
      return {
        phase: PENDING_PHASES[event.action],
        previousStableState: state.previousStableState,
        pendingAction: event.action,
        isTransitioning: true,
      };
    case 'succeed':
      if (!state.isTransitioning || state.pendingAction !== event.action) return state;
      return {
        ...state,
        phase: SUCCESS_PHASES[event.action],
      };
    case 'fail':
      if (!state.isTransitioning || state.pendingAction !== event.action) return state;
      return {
        ...state,
        phase: 'error',
      };
    case 'animation-complete': {
      if (event.phase !== state.phase) return state;
      if (event.phase === 'error') {
        return createTimerLogoControllerState(state.previousStableState);
      }
      if (!state.pendingAction || event.phase !== SUCCESS_PHASES[state.pendingAction]) return state;
      return createTimerLogoControllerState(SUCCESS_STABLE_PHASES[state.pendingAction]);
    }
    case 'reset':
      return createTimerLogoControllerState(event.stableState);
  }
}

export function getTimerStableLogoState(input: { isClockedIn: boolean; isPaused: boolean }): Time2PayStableLogoState {
  if (!input.isClockedIn) return 'clocked-out-idle';
  return input.isPaused ? 'paused-idle' : 'clocked-in-idle';
}

export function shouldOpenTimerCompletionModal(phase: Time2PayLogoState): boolean {
  return phase === 'clock-out-success';
}
