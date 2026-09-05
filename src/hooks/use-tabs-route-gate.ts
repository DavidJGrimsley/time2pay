import { usePathname, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useUniwind } from 'uniwind';
import { useResolvedDataMode } from '@/hooks/use-resolved-data-mode';
import { getProfileCompletion } from '@/services/profile-completion';
import { resolveHostedRouteGate } from '@/features/onboarding/onboarding-route-gate';
import { useAuthUiStore } from '@/stores/auth-ui-store';
import { canvasBackground } from '@/components/workspace-nav';

export function useTabsRouteGate() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme: resolvedAppearanceTheme } = useUniwind();
  const isDark = resolvedAppearanceTheme === 'dark';
  const { hostedMode, resolved: dataModeResolved } = useResolvedDataMode();
  const authReady = useAuthUiStore((state) => state.authReady);
  const isAuthenticated = useAuthUiStore((state) => state.isAuthenticated);
  const onboardingGateReady = useAuthUiStore((state) => state.onboardingGateReady);
  const onboardingGateStatus = useAuthUiStore((state) => state.onboardingGateStatus);
  const hostedAccessGateReady = useAuthUiStore((state) => state.hostedAccessGateReady);
  const hostedAccessGateStatus = useAuthUiStore((state) => state.hostedAccessGateStatus);
  const tourModeEnabled = useAuthUiStore((state) => state.tourModeEnabled);
  const tourModeHydrated = useAuthUiStore((state) => state.tourModeHydrated);
  const routeGate = resolveHostedRouteGate({
    authReady,
    hostedAccessGateReady,
    hostedAccessGateStatus,
    hostedMode,
    isAuthenticated,
    isTourSeedReady: true,
    onboardingGateReady,
    onboardingGateStatus,
    pathname,
    tourModeEnabled,
    tourModeHydrated,
  });
  const shouldHoldTabsForRootGate =
    hostedMode && (!routeGate.canAccessAppRoutes || routeGate.shouldShowLoadingShell);
  const shouldBypassProfileGate =
    shouldHoldTabsForRootGate || (dataModeResolved && tourModeEnabled);
  const [profileGateReady, setProfileGateReady] = useState(false);
  const [profileComplete, setProfileComplete] = useState(true);

  useEffect(() => {
    let isActive = true;

    if (shouldBypassProfileGate) {
      setProfileComplete(true);
      setProfileGateReady(true);
      return () => {
        isActive = false;
      };
    }

    setProfileGateReady(false);

    getProfileCompletion()
      .then((completion) => {
        if (!isActive) {
          return;
        }

        setProfileComplete(completion.isComplete);
      })
      .catch(() => {
        if (!isActive) {
          return;
        }

        setProfileComplete(false);
      })
      .finally(() => {
        if (isActive) {
          setProfileGateReady(true);
        }
      });

    return () => {
      isActive = false;
    };
  }, [shouldBypassProfileGate]);

  useEffect(() => {
    if (!profileGateReady || shouldBypassProfileGate || profileComplete) {
      return;
    }

    router.replace('/settings');
  }, [profileComplete, profileGateReady, router, shouldBypassProfileGate]);

  return {
    backgroundColor: canvasBackground(isDark),
    isDark,
    isTabsGateLoading: !profileGateReady && !shouldBypassProfileGate,
    shouldHoldTabsForRootGate,
  };
}
