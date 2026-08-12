import type { HostedOnboardingGateStatus } from '@/database/hosted/onboarding';

type ResolveHostedOnboardingRedirectInput = {
  authReady: boolean;
  hostedMode: boolean;
  isAuthenticated: boolean;
  isInsideTabsGroup: boolean;
  onboardingGateReady: boolean;
  onboardingGateStatus: HostedOnboardingGateStatus | 'checking' | 'error';
  pathname: string;
  tourModeEnabled: boolean;
  tourModeHydrated: boolean;
};

function normalizePathname(pathname: string): string {
  return pathname !== '/' ? pathname.replace(/\/+$/, '') : pathname;
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

export function resolveHostedOnboardingRedirect({
  authReady,
  hostedMode,
  isAuthenticated,
  isInsideTabsGroup,
  onboardingGateReady,
  onboardingGateStatus,
  pathname,
  tourModeEnabled,
  tourModeHydrated,
}: ResolveHostedOnboardingRedirectInput): string | null {
  const normalizedPathname = normalizePathname(pathname);

  if (!hostedMode || !tourModeHydrated || !authReady || tourModeEnabled) {
    return null;
  }

  if (!isAuthenticated) {
    if (normalizedPathname === '/onboarding/legal') {
      return '/onboarding/auth';
    }

    if (isLegalUpdatePath(normalizedPathname)) {
      return '/sign-in';
    }

    return isInsideTabsGroup ? '/sign-in' : null;
  }

  if (!onboardingGateReady) {
    return null;
  }

  if (onboardingGateStatus === 'needs-onboarding') {
    return normalizedPathname === '/onboarding' ||
      normalizedPathname === '/onboarding/features'
      ? null
      : '/onboarding';
  }

  if (onboardingGateStatus === 'needs-legal' || onboardingGateStatus === 'error') {
    if (
      normalizedPathname === '/onboarding/legal' ||
      isLegalUpdatePath(normalizedPathname) ||
      isLegalDocumentPath(normalizedPathname)
    ) {
      return null;
    }

    return '/legal/updates';
  }

  if (
    onboardingGateStatus === 'complete' &&
    (normalizedPathname === '/' ||
      normalizedPathname === '/sign-in' ||
      isOnboardingPath(normalizedPathname) ||
      isLegalUpdatePath(normalizedPathname))
  ) {
    return '/dashboard';
  }

  return null;
}
