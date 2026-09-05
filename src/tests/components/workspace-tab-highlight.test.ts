import { describe, expect, it } from 'vitest';
import {
  resolvePrimaryTabIndex,
  tabFillRange,
  tabHighlightDuration,
} from '@/components/workspace-tab-highlight';

describe('tabFillRange', () => {
  it('fully fills the active tab and leaves neighbors empty', () => {
    expect(tabFillRange(0, 0)).toEqual({ left: 0, width: 1 });
    expect(tabFillRange(0, 1)).toEqual({ left: 0, width: 0 });
    expect(tabFillRange(2, 2)).toEqual({ left: 0, width: 1 });
  });

  it('wipes from the left of the destination while emptying the origin from the left', () => {
    const origin = tabFillRange(0.3, 0);
    const destination = tabFillRange(0.3, 1);
    expect(origin.left).toBeCloseTo(0.3);
    expect(origin.width).toBeCloseTo(0.7);
    expect(destination.left).toBeCloseTo(0);
    expect(destination.width).toBeCloseTo(0.3);
  });

  it('fully lights an intermediate tab when jumping from the first to the third', () => {
    expect(tabFillRange(1, 0).width).toBe(0);
    expect(tabFillRange(1, 1)).toEqual({ left: 0, width: 1 });
    expect(tabFillRange(1, 2).width).toBe(0);
  });

  it('hides the fill when the highlight is disabled', () => {
    expect(tabFillRange(0, 0, 0)).toEqual({ left: 0, width: 0 });
  });
});

describe('resolvePrimaryTabIndex', () => {
  it('maps workspace routes onto the four primary tabs', () => {
    expect(resolvePrimaryTabIndex('/dashboard')).toBe(0);
    expect(resolvePrimaryTabIndex('/sessions')).toBe(1);
    expect(resolvePrimaryTabIndex('/invoices')).toBe(2);
    expect(resolvePrimaryTabIndex('/mercury')).toBe(3);
    expect(resolvePrimaryTabIndex('/payments')).toBe(3);
    expect(resolvePrimaryTabIndex('/settings')).toBe(-1);
  });
});

describe('tabHighlightDuration', () => {
  it('takes longer when the highlight has to travel through more pills', () => {
    expect(tabHighlightDuration(0, 1)).toBe(160);
    expect(tabHighlightDuration(0, 3)).toBeGreaterThan(tabHighlightDuration(0, 1));
    expect(tabHighlightDuration(0, 3)).toBeLessThanOrEqual(280);
  });
});
