export const TIME2PAY_LOGO_STATES = [
  'static',
  'alarm',
  'landing-spin',
  'landing-toupee',
  'clocked-out-idle',
  'clocking-in',
  'clock-in-success',
  'clocked-in-idle',
  'pausing',
  'pause-success',
  'paused-idle',
  'resuming',
  'resume-success',
  'clocking-out',
  'clock-out-success',
  'error',
] as const;

export type Time2PayLogoState = (typeof TIME2PAY_LOGO_STATES)[number];
export type Time2PayLogoMotion = 'system' | 'full' | 'reduced';

export type Time2PayStableLogoState = 'clocked-out-idle' | 'clocked-in-idle' | 'paused-idle';

export type Time2PayLogoBadge = 'none' | 'in' | 'pause' | 'out' | 'error';

export type ClockHandAngles = {
  hour: number;
  minute: number;
};

// These are the measured bounds of the supplied dollar-sign artwork. The small
// overhang makes a 0% fill begin below the bottom tip and a 100% fill include
// the vertical stroke above the S.
export const TIME2PAY_DOLLAR_FILL_BOUNDS = {
  x: 320,
  y: 316.5,
  width: 70,
  height: 108.5,
} as const;

export function getDollarFillClip(progress: number): { y: number; height: number } {
  'worklet';

  const boundedProgress = Math.min(1, Math.max(0, progress));
  return {
    y: TIME2PAY_DOLLAR_FILL_BOUNDS.y + TIME2PAY_DOLLAR_FILL_BOUNDS.height * (1 - boundedProgress),
    height: TIME2PAY_DOLLAR_FILL_BOUNDS.height * boundedProgress,
  };
}

export const TIME2PAY_LOGO_MOTION_METRICS = {
  clockInSuccess: {
    bodySquashY: 0.76,
    dollarPunchScale: 1.68,
    toupeeLiftY: -126,
  },
  clockOutSuccess: {
    dollarEjectY: -175,
    finalDollarY: 0,
  },
} as const;

const PENDING_STATES = new Set<Time2PayLogoState>(['clocking-in', 'pausing', 'resuming', 'clocking-out']);

const FINITE_STATES = new Set<Time2PayLogoState>([
  'alarm',
  'landing-spin',
  'landing-toupee',
  'clock-in-success',
  'pause-success',
  'resume-success',
  'clock-out-success',
  'error',
]);

const STABLE_STATES = new Set<Time2PayLogoState>(['clocked-out-idle', 'clocked-in-idle', 'paused-idle']);

export function resolveLogoDate(value?: Date | number): Date {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? new Date() : value;
  }

  if (typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? new Date() : date;
  }

  return new Date();
}

export function getClockHandAngles(value: Date | number): ClockHandAngles {
  const date = resolveLogoDate(value);
  const milliseconds = date.getMilliseconds();
  const seconds = date.getSeconds() + milliseconds / 1000;
  const minutes = date.getMinutes() + seconds / 60;
  const hours = (date.getHours() % 12) + minutes / 60;

  return {
    hour: hours * 30,
    minute: minutes * 6,
  };
}

export function getMinuteFillProgress(value: Date | number): number {
  const date = resolveLogoDate(value);
  const elapsedSeconds = date.getSeconds() + date.getMilliseconds() / 1000;
  return Math.min(1, Math.max(0, elapsedSeconds / 60));
}

export function isPendingLogoState(state: Time2PayLogoState): boolean {
  return PENDING_STATES.has(state);
}

export function isFiniteLogoState(state: Time2PayLogoState): boolean {
  return FINITE_STATES.has(state);
}

export function isStableLogoState(state: Time2PayLogoState): state is Time2PayStableLogoState {
  return STABLE_STATES.has(state);
}

export function getLogoBadge(state: Time2PayLogoState): Time2PayLogoBadge {
  if (state === 'error') return 'error';
  if (state === 'clock-out-success') return 'out';
  if (state === 'paused-idle' || state === 'pause-success') return 'pause';
  if (
    state === 'clocked-in-idle' ||
    state === 'clock-in-success' ||
    state === 'pausing' ||
    state === 'resuming' ||
    state === 'resume-success' ||
    state === 'clocking-out'
  ) {
    return 'in';
  }

  return 'none';
}

export function getLogoAccessibilityLabel(state: Time2PayLogoState): string {
  switch (state) {
    case 'alarm':
      return 'Time2Pay alarm logo';
    case 'landing-spin':
    case 'landing-toupee':
      return 'Time2Pay logo introduction';
    case 'clocking-in':
      return 'Time2Pay logo, clocking in';
    case 'clock-in-success':
    case 'clocked-in-idle':
      return 'Time2Pay logo, clocked in';
    case 'pausing':
      return 'Time2Pay logo, pausing session';
    case 'pause-success':
    case 'paused-idle':
      return 'Time2Pay logo, session paused';
    case 'resuming':
      return 'Time2Pay logo, resuming session';
    case 'resume-success':
      return 'Time2Pay logo, session resumed';
    case 'clocking-out':
      return 'Time2Pay logo, clocking out';
    case 'clock-out-success':
    case 'clocked-out-idle':
      return 'Time2Pay logo, clocked out';
    case 'error':
      return 'Time2Pay logo, action failed';
    default:
      return 'Time2Pay logo';
  }
}
