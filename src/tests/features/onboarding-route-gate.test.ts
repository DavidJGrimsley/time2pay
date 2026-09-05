import { describe, expect, it } from 'vitest';

import {
  classifyTime2PayRoute,
  resolveHostedOnboardingRedirect,
  resolveHostedRouteGate,
  type ResolveHostedRouteGateInput,
} from '@/features/onboarding/onboarding-route-gate';

const baseInput: ResolveHostedRouteGateInput = {
  authReady: true,
  hostedAccessGateReady: true,
  hostedAccessGateStatus: 'allowed',
  hostedMode: true,
  isAuthenticated: false,
  isTourSeedReady: true,
  onboardingGateReady: false,
  onboardingGateStatus: 'checking',
  pathname: '/',
  tourModeEnabled: false,
  tourModeHydrated: true,
};

function gate(overrides: Partial<ResolveHostedRouteGateInput> = {}) {
  return resolveHostedRouteGate({
    ...baseInput,
    ...overrides,
  });
}

function signedInComplete(overrides: Partial<ResolveHostedRouteGateInput> = {}) {
  return gate({
    isAuthenticated: true,
    onboardingGateReady: true,
    onboardingGateStatus: 'complete',
    ...overrides,
  });
}

describe('classifyTime2PayRoute', () => {
  it.each(['/', '/sign-in', '/pricing', '/privacy', '/terms', '/legal/updates'])(
    'keeps %s public',
    (pathname) => {
      const route = classifyTime2PayRoute(pathname);

      expect(route.isPublicRoute).toBe(true);
      expect(route.isAppRoute).toBe(false);
    },
  );

  it.each(['/onboarding', '/onboarding/features', '/onboarding/auth', '/onboarding/legal'])(
    'keeps onboarding route %s public',
    (pathname) => {
      const route = classifyTime2PayRoute(pathname);

      expect(route.isPublicRoute).toBe(true);
      expect(route.isOnboardingRoute).toBe(true);
      expect(route.isAppRoute).toBe(false);
    },
  );

  it.each(['/settings', '/settings/billing', '/settings/customers-projects', '/access-required'])(
    'classifies %s as a signed-in account route',
    (pathname) => {
      const route = classifyTime2PayRoute(pathname);

      expect(route.isAccountRoute).toBe(true);
      expect(route.isAppRoute).toBe(false);
      expect(route.isPublicRoute).toBe(false);
    },
  );

  it.each(['/dashboard', '/sessions', '/projects', '/invoices', '/bank', '/payments'])(
    'classifies tab route %s as protected app content',
    (pathname) => {
      const route = classifyTime2PayRoute(pathname);

      expect(route.isAppRoute).toBe(true);
      expect(route.isPublicRoute).toBe(false);
      expect(route.isAccountRoute).toBe(false);
    },
  );
});

describe('resolveHostedRouteGate direct URL access', () => {
  it.each(['/dashboard', '/sessions', '/projects', '/invoices', '/bank', '/payments'])(
    'sends signed-out app route %s to sign-in',
    (pathname) => {
      const decision = gate({ pathname });

      expect(decision.redirectTarget).toBe('/sign-in');
      expect(decision.canAccessAppRoutes).toBe(false);
      expect(decision.canMountAppRoutes).toBe(false);
    },
  );

  it.each(['/settings', '/settings/billing', '/settings/customers-projects', '/access-required'])(
    'sends signed-out account route %s to sign-in',
    (pathname) => {
      const decision = gate({ pathname });

      expect(decision.redirectTarget).toBe('/sign-in');
      expect(decision.canAccessAccountRoutes).toBe(false);
      expect(decision.canMountAccountRoutes).toBe(false);
    },
  );

  it('sends signed-out onboarding legal visits to onboarding auth', () => {
    expect(gate({ pathname: '/onboarding/legal' }).redirectTarget).toBe('/onboarding/auth');
  });

  it('keeps public legal, pricing, and legal-update pages public for signed-out users', () => {
    for (const pathname of ['/pricing', '/privacy', '/terms', '/legal/updates']) {
      expect(gate({ pathname }).redirectTarget).toBeNull();
    }
  });

  it('holds protected app URLs on the loading shell while hosted auth is unresolved', () => {
    const decision = gate({
      authReady: false,
      hostedAccessGateReady: false,
      hostedAccessGateStatus: 'checking',
      pathname: '/dashboard',
    });

    expect(decision.canAccessAppRoutes).toBe(false);
    expect(decision.canMountAppRoutes).toBe(true);
    expect(decision.shouldShowLoadingShell).toBe(true);
    expect(decision.redirectTarget).toBeNull();
  });
});

describe('resolveHostedRouteGate first navigation after auth', () => {
  it('sends a complete signed-in user from sign-in to dashboard', () => {
    expect(signedInComplete({ pathname: '/sign-in' }).redirectTarget).toBe('/dashboard');
  });

  it('sends an onboarding auth completion to onboarding legal when legal is still needed', () => {
    const decision = gate({
      isAuthenticated: true,
      onboardingGateReady: true,
      onboardingGateStatus: 'needs-legal',
      pathname: '/onboarding/auth',
    });

    expect(decision.redirectTarget).toBe('/onboarding/legal');
  });
});

describe('resolveHostedRouteGate onboarding completion', () => {
  it.each(['/onboarding', '/onboarding/features', '/onboarding/auth', '/onboarding/legal'])(
    'sends completed users away from %s and into the app',
    (pathname) => {
      expect(signedInComplete({ pathname }).redirectTarget).toBe('/dashboard');
    },
  );

  it('allows completed users to stay on dashboard', () => {
    const decision = signedInComplete({ pathname: '/dashboard' });

    expect(decision.redirectTarget).toBeNull();
    expect(decision.canAccessAppRoutes).toBe(true);
  });
});

describe('resolveHostedRouteGate legal-update gating', () => {
  it('blocks app tabs when legal acceptance is stale', () => {
    const decision = gate({
      isAuthenticated: true,
      onboardingGateReady: true,
      onboardingGateStatus: 'needs-legal',
      pathname: '/payments',
    });

    expect(decision.redirectTarget).toBe('/legal/updates');
    expect(decision.canAccessAppRoutes).toBe(false);
  });

  it.each(['/terms', '/privacy', '/legal/updates', '/onboarding/legal'])(
    'allows stale legal users to stay on %s',
    (pathname) => {
      const decision = gate({
        isAuthenticated: true,
        onboardingGateReady: true,
        onboardingGateStatus: 'needs-legal',
        pathname,
      });

      expect(decision.redirectTarget).toBeNull();
      expect(decision.canAccessAppRoutes).toBe(false);
    },
  );
});

describe('resolveHostedRouteGate onboarding gating', () => {
  it('sends authenticated users with no onboarding state to onboarding', () => {
    const decision = gate({
      isAuthenticated: true,
      onboardingGateReady: true,
      onboardingGateStatus: 'needs-onboarding',
      pathname: '/dashboard',
    });

    expect(decision.redirectTarget).toBe('/onboarding');
    expect(decision.canAccessAppRoutes).toBe(false);
  });

  it.each(['/onboarding', '/onboarding/features'])(
    'allows users missing onboarding state to stay on %s',
    (pathname) => {
      const decision = gate({
        isAuthenticated: true,
        onboardingGateReady: true,
        onboardingGateStatus: 'needs-onboarding',
        pathname,
      });

      expect(decision.redirectTarget).toBeNull();
      expect(decision.canAccessAppRoutes).toBe(false);
    },
  );
});

describe('resolveHostedRouteGate paywall and hosted access gating', () => {
  it('holds protected app URLs while hosted access is unresolved', () => {
    const decision = signedInComplete({
      hostedAccessGateReady: false,
      hostedAccessGateStatus: 'checking',
      pathname: '/dashboard',
    });

    expect(decision.canAccessAppRoutes).toBe(false);
    expect(decision.canMountAppRoutes).toBe(true);
    expect(decision.shouldShowLoadingShell).toBe(true);
    expect(decision.redirectTarget).toBeNull();
  });

  it('sends complete hosted users without access to access-required', () => {
    const decision = signedInComplete({
      hostedAccessGateStatus: 'blocked',
      pathname: '/dashboard',
    });

    expect(decision.redirectTarget).toBe('/access-required');
    expect(decision.canAccessAppRoutes).toBe(false);
  });

  it.each(['/access-required', '/settings', '/settings/billing', '/settings/customers-projects'])(
    'keeps %s reachable without hosted access',
    (pathname) => {
      const decision = signedInComplete({
        hostedAccessGateStatus: 'blocked',
        pathname,
      });

      expect(decision.redirectTarget).toBeNull();
      expect(decision.canAccessAccountRoutes).toBe(true);
      expect(decision.canAccessAppRoutes).toBe(false);
    },
  );

  it('treats hosted users as app-eligible when hosted access enforcement is not active', () => {
    const decision = signedInComplete({
      hostedAccessGateStatus: 'allowed',
      pathname: '/dashboard',
    });

    expect(decision.redirectTarget).toBeNull();
    expect(decision.canAccessAppRoutes).toBe(true);
  });

  it('fails open when the hosted access check errors instead of forcing the paywall', () => {
    const decision = signedInComplete({
      hostedAccessGateStatus: 'error',
      pathname: '/dashboard',
    });

    expect(decision.redirectTarget).toBeNull();
    expect(decision.canAccessAppRoutes).toBe(true);
  });

  it('sends completed users with hosted access away from access-required and into dashboard', () => {
    expect(signedInComplete({ pathname: '/access-required' }).redirectTarget).toBe('/dashboard');
  });
});

describe('resolveHostedOnboardingRedirect compatibility wrapper', () => {
  it('returns the route-gate redirect target for callers still using the old helper name', () => {
    expect(
      resolveHostedOnboardingRedirect({
        ...baseInput,
        isInsideTabsGroup: true,
        pathname: '/dashboard',
      }),
    ).toBe('/sign-in');
  });

  it('does not gate local mode', () => {
    const decision = gate({
      hostedMode: false,
      pathname: '/dashboard',
    });

    expect(decision.redirectTarget).toBeNull();
    expect(decision.canAccessAppRoutes).toBe(true);
    expect(decision.canAccessAccountRoutes).toBe(true);
  });

  it('does not gate a seeded tour', () => {
    const decision = gate({
      pathname: '/dashboard',
      tourModeEnabled: true,
    });

    expect(decision.redirectTarget).toBeNull();
    expect(decision.canAccessAppRoutes).toBe(true);
  });
});
