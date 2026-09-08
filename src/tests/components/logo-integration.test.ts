import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n');

describe('logo integrations', () => {
  it('keeps the dashboard logo in a fixed responsive square and removes competing loaders', () => {
    const timerSource = readSource('src/components/Timer.tsx');

    expect(timerSource).toContain('const timerLogoSize = isLargeScreen ? 480 : Math.min(288');
    expect(timerSource).toContain('style={{ width: timerLogoSize, height: timerLogoSize }}');
    expect(timerSource).toContain('testID="timer-logo-frame"');
    expect(timerSource).toContain('sessionElapsedSeconds={isClockedIn ? elapsedSeconds : 0}');
    expect(timerSource).not.toContain('Currently clocked in');
    expect(timerSource).toContain("flexDirection: 'column-reverse'");
    expect(timerSource).toContain('useAppTheme');
    expect(timerSource).toContain('var(--color-heading)');
    expect(timerSource).not.toContain('animate-pulse');
    expect(timerSource).not.toContain('ClockIcon');
  });

  it('defers the completion modal through the animation completion callback', () => {
    const timerSource = readSource('src/components/Timer.tsx');
    const successDispatch = timerSource.search(/dispatchTimerLogo\(\{\s*type: 'succeed',\s*action: 'clock-out'\s*\}\)/);
    const modalOpen = timerSource.indexOf('if (shouldOpenTimerCompletionModal(phase))');

    expect(successDispatch).toBeGreaterThan(0);
    expect(modalOpen).toBeGreaterThan(0);
    expect(timerSource).not.toContain('setCompletedSessionNotes(currentNotes);\n      setShowCompleteModal(true);');
  });

  it('uses the SVG sequence instead of the old delayed landing PNG entrance', () => {
    const landingSource = readSource('src/components/landing/landing-page.tsx');

    expect(landingSource).toContain('<AnimatedTime2PayLogo');
    expect(landingSource).toContain('useAppTheme');
    expect(landingSource).toContain('var(--color-heading)');
    expect(landingSource).toContain('getLandingLogoCompletionTransition');
    expect(landingSource).not.toContain('logoProgress');
    expect(landingSource).not.toContain("'/images/time2payLogo.png'");
  });
});
