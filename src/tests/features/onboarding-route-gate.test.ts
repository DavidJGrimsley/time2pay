import { describe, expect, it } from 'vitest';

import { resolveHostedOnboardingRedirect } from '@/features/onboarding/onboarding-route-gate';

const baseInput = {
  authReady: true,
  hostedMode: true,
  isAuthenticated: false,
  isInsideTabsGroup: false,
  onboardingGateReady: false,
  onboardingGateStatus: 'checking' as const,
  pathname: '/',
  tourModeEnabled: false,
  tourModeHydrated: true,
};

describe('resolveHostedOnboardingRedirect', () => {
  it('sends signed-out protected routes to sign-in', () => {
    expect(
      resolveHostedOnboardingRedirect({
        ...baseInput,
        isInsideTabsGroup: true,
        pathname: '/dashboard',
      }),
    ).toBe('/sign-in');
  });

  it('sends signed-out direct legal visits to onboarding auth', () => {
    expect(
      resolveHostedOnboardingRedirect({
        ...baseInput,
        pathname: '/onboarding/legal',
      }),
    ).toBe('/onboarding/auth');
  });

  it('sends signed-out direct legal update visits to sign-in', () => {
    expect(
      resolveHostedOnboardingRedirect({
        ...baseInput,
        pathname: '/legal/updates',
      }),
    ).toBe('/sign-in');
  });

  it('sends authenticated users with no onboarding state to onboarding', () => {
    expect(
      resolveHostedOnboardingRedirect({
        ...baseInput,
        isAuthenticated: true,
        onboardingGateReady: true,
        onboardingGateStatus: 'needs-onboarding',
        pathname: '/dashboard',
      }),
    ).toBe('/onboarding');
  });

  it('sends existing users missing legal acceptance to legal only', () => {
    expect(
      resolveHostedOnboardingRedirect({
        ...baseInput,
        isAuthenticated: true,
        onboardingGateReady: true,
        onboardingGateStatus: 'needs-legal',
        pathname: '/sign-in',
      }),
    ).toBe('/legal/updates');
  });

  it('allows authenticated users missing legal acceptance to stay on onboarding legal', () => {
    expect(
      resolveHostedOnboardingRedirect({
        ...baseInput,
        isAuthenticated: true,
        onboardingGateReady: true,
        onboardingGateStatus: 'needs-legal',
        pathname: '/onboarding/legal',
      }),
    ).toBeNull();
  });

  it('allows authenticated users missing legal acceptance to stay on legal updates', () => {
    expect(
      resolveHostedOnboardingRedirect({
        ...baseInput,
        isAuthenticated: true,
        onboardingGateReady: true,
        onboardingGateStatus: 'needs-legal',
        pathname: '/legal/updates',
      }),
    ).toBeNull();
  });

  it('sends complete authenticated users away from auth and onboarding routes', () => {
    expect(
      resolveHostedOnboardingRedirect({
        ...baseInput,
        isAuthenticated: true,
        onboardingGateReady: true,
        onboardingGateStatus: 'complete',
        pathname: '/onboarding/legal',
      }),
    ).toBe('/dashboard');
  });

  it('sends complete authenticated users away from legal updates', () => {
    expect(
      resolveHostedOnboardingRedirect({
        ...baseInput,
        isAuthenticated: true,
        onboardingGateReady: true,
        onboardingGateStatus: 'complete',
        pathname: '/legal/updates',
      }),
    ).toBe('/dashboard');
  });

  it('does not gate tour mode', () => {
    expect(
      resolveHostedOnboardingRedirect({
        ...baseInput,
        isInsideTabsGroup: true,
        pathname: '/dashboard',
        tourModeEnabled: true,
      }),
    ).toBeNull();
  });
});
