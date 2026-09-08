import { describe, expect, it } from 'vitest';
import {
  getClockHandAngles,
  getDollarFillClip,
  getLogoAccessibilityLabel,
  getLogoBadge,
  getMinuteFillProgress,
  isFiniteLogoState,
  isPendingLogoState,
  TIME2PAY_LOGO_MOTION_METRICS,
} from '@/components/branding/time2pay-logo-motion';
import { getLandingLogoCompletionTransition, getLandingLogoSize } from '@/components/landing/landing-logo-sequence';

describe('Time2Pay logo motion calculations', () => {
  it('calculates smooth hour and minute hand angles', () => {
    const angles = getClockHandAngles(new Date(2026, 0, 1, 3, 15, 30, 0));

    expect(angles.minute).toBeCloseTo(93);
    expect(angles.hour).toBeCloseTo(97.75);
  });

  it('maps seven fifty-nine to the corresponding live-clock angles', () => {
    const angles = getClockHandAngles(new Date(2026, 0, 1, 7, 59, 0, 0));

    expect(angles.hour).toBeCloseTo(239.5);
    expect(angles.minute).toBeCloseTo(354);
  });

  it('resets minute fill at the start of the next minute', () => {
    const endOfMinute = getMinuteFillProgress(new Date(2026, 0, 1, 3, 15, 59, 900));
    const nextMinute = getMinuteFillProgress(new Date(2026, 0, 1, 3, 16, 0, 0));

    expect(endOfMinute).toBeGreaterThan(0.99);
    expect(nextMinute).toBe(0);
  });

  it('clips the dollar from its exact bottom tip through the full top stroke', () => {
    expect(getDollarFillClip(0)).toEqual({ y: 425, height: 0 });
    expect(getDollarFillClip(1)).toEqual({ y: 316.5, height: 108.5 });
    expect(getDollarFillClip(0.5)).toEqual({ y: 370.75, height: 54.25 });
  });

  it('classifies pending and finite states independently', () => {
    expect(isPendingLogoState('clocking-in')).toBe(true);
    expect(isPendingLogoState('clock-in-success')).toBe(false);
    expect(isFiniteLogoState('clock-in-success')).toBe(true);
    expect(isFiniteLogoState('clocked-in-idle')).toBe(false);
  });

  it('maps badges and state-aware accessibility labels', () => {
    expect(getLogoBadge('clocked-in-idle')).toBe('in');
    expect(getLogoBadge('paused-idle')).toBe('pause');
    expect(getLogoBadge('clock-out-success')).toBe('out');
    expect(getLogoBadge('error')).toBe('error');
    expect(getLogoAccessibilityLabel('pausing')).toContain('pausing');
  });

  it('keeps clock-in punch dramatic and clock-out ejection neutral at completion', () => {
    expect(TIME2PAY_LOGO_MOTION_METRICS.clockInSuccess.toupeeLiftY).toBeLessThanOrEqual(-100);
    expect(TIME2PAY_LOGO_MOTION_METRICS.clockInSuccess.dollarPunchScale).toBeGreaterThanOrEqual(1.5);
    expect(TIME2PAY_LOGO_MOTION_METRICS.clockOutSuccess.dollarEjectY).toBeLessThan(-100);
    expect(TIME2PAY_LOGO_MOTION_METRICS.clockOutSuccess.finalDollarY).toBe(0);
  });
});

describe('landing logo sequence', () => {
  it('fits the logo inside a compact desktop hero column', () => {
    expect(getLandingLogoSize(769, 767)).toBeCloseTo(276.84);
    expect(getLandingLogoSize(769, 767)).toBeLessThan(300);
  });

  it('orders clock spin, hero reveal, toupee flight, and idle', () => {
    expect(getLandingLogoCompletionTransition('landing-spin', false)).toEqual({
      nextState: 'landing-toupee',
      revealHero: true,
      delayMs: 620,
    });
    expect(getLandingLogoCompletionTransition('landing-toupee', false)).toEqual({
      nextState: 'clocked-out-idle',
      revealHero: false,
      delayMs: 0,
    });
  });

  it('uses the immediate reduced-motion reveal path', () => {
    expect(getLandingLogoCompletionTransition('landing-spin', true)?.delayMs).toBe(140);
  });
});
