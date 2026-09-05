import type { HostedOnboardingGateStatus } from '@/database/hosted/onboarding';

export type HostedAccessGateStatus = 'checking' | 'allowed' | 'blocked' | 'error';

export type Time2PayRouteClassification = {
  normalizedPathname: string;
  isAccessRequiredRoute: boolean;
  isAccountRoute: boolean;
  isAppRoute: boolean;
  isLegalDocumentRoute: boolean;
  isLegalUpdateRoute: boolean;
  isOnboardingAuthRoute: boolean;
  isOnboardingLegalRoute: boolean;
  isOnboardingRoute: boolean;
  isPricingRoute: boolean;
  isPublicRoute: boolean;
  isRootRoute: boolean;
  isSignInRoute: boolean;
};

export type ResolveHostedRouteGateInput = {
  authReady: boolean;
  hostedAccessGateReady: boolean;
  hostedAccessGateStatus: HostedAccessGateStatus;
  hostedMode: boolean;
  isAuthenticated: boolean;
  isTourSeedReady: boolean;
  onboardingGateReady: boolean;
  onboardingGateStatus: HostedOnboardingGateStatus | 'checking' | 'error';
  pathname: string;
  tourModeEnabled: boolean;
  tourModeHydrated: boolean;
};

export type HostedRouteGateDecision = Time2PayRouteClassification & {
  canAccessAccountRoutes: boolean;
  canAccessAppRoutes: boolean;
  canMountAccountRoutes: boolean;
  canMountAppRoutes: boolean;
  redirectTarget: string | null;
  shouldShowLoadingShell: boolean;
};

type ResolveHostedOnboardingRedirectInput = Omit<
  ResolveHostedRouteGateInput,
  'hostedAccessGateReady' | 'hostedAccessGateStatus' | 'isTourSeedReady'
> & {
  hostedAccessGateReady?: boolean;
  hostedAccessGateStatus?: HostedAccessGateStatus;
  isInsideTabsGroup?: boolean;
  isTourSeedReady?: boolean;
};

function normalizePathname(pathname: string): string {
  const pathOnly = pathname.split(/[?#]/)[0] || '/';
  const withLeadingSlash = pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}`;
  return withLeadingSlash !== '/' ? withLeadingSlash.replace(/\/+$/, '') : '/';
}

function isOnboardingPath(pathname: string): boolean {
  return pathname === '/onboarding' || pathname.startsWith('/onboarding/');
}

function isLegalDocumentPath(pathname: string): boolean {
  return pathname === '/terms' || pathname === '/privacy';
}

function isLegalUpdatePath(pathname: string): boolean {
  return pathname === '/legal/updates';
}

function isSettingsPath(pathname: string): boolean {
  return pathname === '/settings' || pathname.startsWith('/settings/');
}

function shouldHoldForPendingDecision(route: Time2PayRouteClassification): boolean {
  return (
    route.isAppRoute ||
    route.isAccountRoute ||
    route.isRootRoute ||
    route.isSignInRoute ||
    route.isOnboardingRoute ||
    route.isLegalUpdateRoute
  );
}

function shouldHoldForHostedAccessDecision(route: Time2PayRouteClassification): boolean {
  return (
    route.isAppRoute ||
    route.isRootRoute ||
    route.isSignInRoute ||
    route.isOnboardingRoute ||
    route.isLegalUpdateRoute ||
    route.isAccessRequiredRoute
  );
}

function toDecision(
  route: Time2PayRouteClassification,
  input: {
    canAccessAccountRoutes: boolean;
    canAccessAppRoutes: boolean;
    canMountAccountRoutes?: boolean;
    canMountAppRoutes?: boolean;
    redirectTarget?: string | null;
    shouldShowLoadingShell?: boolean;
  },
): HostedRouteGateDecision {
  return {
    ...route,
    canAccessAccountRoutes: input.canAccessAccountRoutes,
    canAccessAppRoutes: input.canAccessAppRoutes,
    canMountAccountRoutes: input.canMountAccountRoutes ?? input.canAccessAccountRoutes,
    canMountAppRoutes: input.canMountAppRoutes ?? input.canAccessAppRoutes,
    redirectTarget: input.redirectTarget ?? null,
    shouldShowLoadingShell: input.shouldShowLoadingShell ?? false,
  };
}

export function classifyTime2PayRoute(pathname: string): Time2PayRouteClassification {
  const normalizedPathname = normalizePathname(pathname);
  const isRootRoute = normalizedPathname === '/';
  const isSignInRoute = normalizedPathname === '/sign-in';
  const isPricingRoute = normalizedPathname === '/pricing';
  const isOnboardingRoute = isOnboardingPath(normalizedPathname);
  const isOnboardingAuthRoute = normalizedPathname === '/onboarding/auth';
  const isOnboardingLegalRoute = normalizedPathname === '/onboarding/legal';
  const isLegalDocumentRoute = isLegalDocumentPath(normalizedPathname);
  const isLegalUpdateRoute = isLegalUpdatePath(normalizedPathname);
  const isAccessRequiredRoute = normalizedPathname === '/access-required';
  const isAccountRoute =
    isAccessRequiredRoute ||
    isSettingsPath(normalizedPathname);
  const isPublicRoute =
    isRootRoute ||
    isSignInRoute ||
    isPricingRoute ||
    isLegalDocumentRoute ||
    isLegalUpdateRoute ||
    isOnboardingRoute;

  return {
    normalizedPathname,
    isAccessRequiredRoute,
    isAccountRoute,
    isAppRoute: !isPublicRoute && !isAccountRoute,
    isLegalDocumentRoute,
    isLegalUpdateRoute,
    isOnboardingAuthRoute,
    isOnboardingLegalRoute,
    isOnboardingRoute,
    isPricingRoute,
    isPublicRoute,
    isRootRoute,
    isSignInRoute,
  };
}

export function resolveHostedRouteGate(input: ResolveHostedRouteGateInput): HostedRouteGateDecision {
  const route = classifyTime2PayRoute(input.pathname);

  if (!input.hostedMode) {
    return toDecision(route, {
      canAccessAccountRoutes: true,
      canAccessAppRoutes: true,
    });
  }

  if (!input.tourModeHydrated || !input.authReady) {
    return toDecision(route, {
      canAccessAccountRoutes: false,
      canAccessAppRoutes: false,
      canMountAccountRoutes: route.isAccountRoute,
      canMountAppRoutes: route.isAppRoute,
      shouldShowLoadingShell: shouldHoldForPendingDecision(route),
    });
  }

  if (input.tourModeEnabled) {
    return toDecision(route, {
      canAccessAccountRoutes: input.isTourSeedReady,
      canAccessAppRoutes: input.isTourSeedReady,
      canMountAccountRoutes: route.isAccountRoute || input.isTourSeedReady,
      canMountAppRoutes: route.isAppRoute || input.isTourSeedReady,
      shouldShowLoadingShell: !input.isTourSeedReady && (route.isAppRoute || route.isAccountRoute),
    });
  }

  if (!input.isAuthenticated) {
    const redirectTarget = route.isOnboardingLegalRoute
      ? '/onboarding/auth'
      : route.isAppRoute || route.isAccountRoute
        ? '/sign-in'
        : null;

    return toDecision(route, {
      canAccessAccountRoutes: false,
      canAccessAppRoutes: false,
      redirectTarget,
      shouldShowLoadingShell: route.isAccountRoute || route.isAppRoute,
    });
  }

  if (!input.onboardingGateReady) {
    return toDecision(route, {
      canAccessAccountRoutes: true,
      canAccessAppRoutes: false,
      canMountAccountRoutes: true,
      canMountAppRoutes: route.isAppRoute,
      shouldShowLoadingShell: shouldHoldForPendingDecision(route) && !route.isAccountRoute,
    });
  }

  if (input.onboardingGateStatus === 'needs-onboarding') {
    const canStayOnOnboardingIntro =
      route.normalizedPathname === '/onboarding' || route.normalizedPathname === '/onboarding/features';
    const redirectTarget =
      route.isAccountRoute || route.isPricingRoute || route.isLegalDocumentRoute || canStayOnOnboardingIntro
        ? null
        : '/onboarding';

    return toDecision(route, {
      canAccessAccountRoutes: true,
      canAccessAppRoutes: false,
      canMountAccountRoutes: true,
      canMountAppRoutes: route.isAppRoute,
      redirectTarget,
      shouldShowLoadingShell: route.isAppRoute,
    });
  }

  if (input.onboardingGateStatus === 'needs-legal' || input.onboardingGateStatus === 'error') {
    const canStayOnLegalGate =
      route.isOnboardingLegalRoute || route.isLegalUpdateRoute || route.isLegalDocumentRoute;
    const redirectTargetFromOnboarding =
      route.normalizedPathname === '/onboarding' ||
      route.normalizedPathname === '/onboarding/features' ||
      route.isOnboardingAuthRoute
        ? '/onboarding/legal'
        : null;
    const redirectTarget =
      route.isAccountRoute || route.isPricingRoute || canStayOnLegalGate
        ? null
        : redirectTargetFromOnboarding ?? '/legal/updates';

    return toDecision(route, {
      canAccessAccountRoutes: true,
      canAccessAppRoutes: false,
      canMountAccountRoutes: true,
      canMountAppRoutes: route.isAppRoute,
      redirectTarget,
      shouldShowLoadingShell: route.isAppRoute,
    });
  }

  if (!input.hostedAccessGateReady) {
    return toDecision(route, {
      canAccessAccountRoutes: true,
      canAccessAppRoutes: false,
      canMountAccountRoutes: true,
      canMountAppRoutes: route.isAppRoute,
      shouldShowLoadingShell: shouldHoldForHostedAccessDecision(route),
    });
  }

  if (input.hostedAccessGateStatus === 'blocked') {
    const shouldRedirectToAccessRequired =
      route.isAppRoute ||
      route.isRootRoute ||
      route.isSignInRoute ||
      route.isOnboardingRoute ||
      route.isLegalUpdateRoute;

    return toDecision(route, {
      canAccessAccountRoutes: true,
      canAccessAppRoutes: false,
      canMountAccountRoutes: true,
      canMountAppRoutes: route.isAppRoute,
      redirectTarget: shouldRedirectToAccessRequired ? '/access-required' : null,
      shouldShowLoadingShell: route.isAppRoute,
    });
  }

  const shouldRedirectToDashboard =
    route.isRootRoute ||
    route.isSignInRoute ||
    route.isOnboardingRoute ||
    route.isLegalUpdateRoute ||
    route.isAccessRequiredRoute;

  return toDecision(route, {
    canAccessAccountRoutes: true,
    canAccessAppRoutes: true,
    canMountAccountRoutes: true,
    redirectTarget: shouldRedirectToDashboard ? '/dashboard' : null,
  });
}

export function resolveHostedOnboardingRedirect(
  input: ResolveHostedOnboardingRedirectInput,
): string | null {
  return resolveHostedRouteGate({
    authReady: input.authReady,
    hostedAccessGateReady: input.hostedAccessGateReady ?? true,
    hostedAccessGateStatus: input.hostedAccessGateStatus ?? 'allowed',
    hostedMode: input.hostedMode,
    isAuthenticated: input.isAuthenticated,
    isTourSeedReady: input.isTourSeedReady ?? true,
    onboardingGateReady: input.onboardingGateReady,
    onboardingGateStatus: input.onboardingGateStatus,
    pathname: input.pathname,
    tourModeEnabled: input.tourModeEnabled,
    tourModeHydrated: input.tourModeHydrated,
  }).redirectTarget;
}
