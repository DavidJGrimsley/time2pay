import type { Time2PayLogoState } from '@/components/branding/time2pay-logo-motion';

export type LandingLogoCompletionTransition = {
  nextState: Time2PayLogoState;
  revealHero: boolean;
  delayMs: number;
};

export function getLandingLogoSize(viewportWidth: number, viewportHeight: number): number {
  const isDesktop = viewportWidth >= 768;
  const isLarge = viewportWidth >= 1200;
  const isShort = viewportHeight < 880;
  const availableWidth = isDesktop ? viewportWidth * 0.36 : viewportWidth - 48;
  const sizeCap = isLarge ? (isShort ? 440 : 520) : isDesktop ? (isShort ? 320 : 400) : 360;

  return Math.max(180, Math.min(availableWidth, sizeCap));
}

export function getLandingLogoCompletionTransition(
  completedState: Time2PayLogoState,
  reducedMotion: boolean,
): LandingLogoCompletionTransition | null {
  if (completedState === 'landing-spin') {
    return {
      nextState: 'landing-toupee',
      revealHero: true,
      delayMs: reducedMotion ? 140 : 620,
    };
  }

  if (completedState === 'landing-toupee') {
    return {
      nextState: 'clocked-out-idle',
      revealHero: false,
      delayMs: 0,
    };
  }

  return null;
}
