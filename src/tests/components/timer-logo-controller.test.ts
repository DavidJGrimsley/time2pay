import { describe, expect, it } from 'vitest';
import {
  createTimerLogoControllerState,
  getTimerStableLogoState,
  shouldOpenTimerCompletionModal,
  timerLogoReducer,
  type TimerLogoAction,
} from '@/components/branding/timer-logo-controller';

function completeFlow(action: TimerLogoAction) {
  let state = createTimerLogoControllerState(
    action === 'clock-in' ? 'clocked-out-idle' : action === 'resume' ? 'paused-idle' : 'clocked-in-idle',
  );
  state = timerLogoReducer(state, { type: 'start', action });
  state = timerLogoReducer(state, { type: 'succeed', action });
  state = timerLogoReducer(state, {
    type: 'animation-complete',
    phase: state.phase,
  });
  return state;
}

describe('timer logo controller', () => {
  it('keeps actions locked through the clock-in finish animation', () => {
    let state = createTimerLogoControllerState('clocked-out-idle');
    state = timerLogoReducer(state, { type: 'start', action: 'clock-in' });
    expect(state).toMatchObject({
      phase: 'clocking-in',
      pendingAction: 'clock-in',
      isTransitioning: true,
    });

    state = timerLogoReducer(state, { type: 'succeed', action: 'clock-in' });
    expect(state.phase).toBe('clock-in-success');
    expect(state.isTransitioning).toBe(true);

    state = timerLogoReducer(state, {
      type: 'animation-complete',
      phase: 'clock-in-success',
    });
    expect(state).toEqual(createTimerLogoControllerState('clocked-in-idle'));
  });

  it('ignores duplicate actions while a request or finish is active', () => {
    const pending = timerLogoReducer(createTimerLogoControllerState('clocked-in-idle'), {
      type: 'start',
      action: 'pause',
    });

    expect(timerLogoReducer(pending, { type: 'start', action: 'clock-out' })).toBe(pending);
    expect(timerLogoReducer(pending, { type: 'succeed', action: 'resume' })).toBe(pending);
  });

  it('restores the previous stable state after an error animation', () => {
    let state = createTimerLogoControllerState('paused-idle');
    state = timerLogoReducer(state, { type: 'start', action: 'resume' });
    state = timerLogoReducer(state, { type: 'fail', action: 'resume' });
    expect(state.phase).toBe('error');
    expect(state.isTransitioning).toBe(true);

    state = timerLogoReducer(state, {
      type: 'animation-complete',
      phase: 'error',
    });
    expect(state).toEqual(createTimerLogoControllerState('paused-idle'));
  });

  it('finishes pause, resume, and clock-out at their correct stable states', () => {
    expect(completeFlow('pause').phase).toBe('paused-idle');
    expect(completeFlow('resume').phase).toBe('clocked-in-idle');
    expect(completeFlow('clock-out').phase).toBe('clocked-out-idle');
  });

  it('does not sync API state over an active animation', () => {
    const pending = timerLogoReducer(createTimerLogoControllerState('clocked-out-idle'), {
      type: 'start',
      action: 'clock-in',
    });

    expect(
      timerLogoReducer(pending, {
        type: 'sync',
        stableState: 'clocked-in-idle',
      }),
    ).toBe(pending);
  });

  it('derives pause and session stable states', () => {
    expect(getTimerStableLogoState({ isClockedIn: false, isPaused: false })).toBe('clocked-out-idle');
    expect(getTimerStableLogoState({ isClockedIn: true, isPaused: false })).toBe('clocked-in-idle');
    expect(getTimerStableLogoState({ isClockedIn: true, isPaused: true })).toBe('paused-idle');
  });

  it('defers the completion modal until clock-out success animation completes', () => {
    expect(shouldOpenTimerCompletionModal('clocking-out')).toBe(false);
    expect(shouldOpenTimerCompletionModal('error')).toBe(false);
    expect(shouldOpenTimerCompletionModal('clock-out-success')).toBe(true);
  });
});
