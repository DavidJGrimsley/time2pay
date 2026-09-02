import { Stack, usePathname, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { LogBox, Platform, StyleSheet, View } from 'react-native';
import { useUniwind } from 'uniwind';
import { AppLoadingShell } from '@/components/app-loading-shell';
import { LandingSeoHead } from '@/components/landing/landing-seo-head';
import { NoIndexSeoHead } from '@/components/no-index-seo-head';
import { bootstrapRuntimeDiagnostics, errorMessage, logRuntimeDiagnostic } from '@/services/runtime-diagnostics';
import {
  getMissingHostedModePublicEnvKeys,
  HOSTED_MODE_REQUIRED_PUBLIC_ENV_KEYS,
  isHostedMode,
  resolveAppAccessMode,
} from '@/services/runtime-mode';
import { getHostedBillingStatus } from '@/services/billing';
import { syncGitHubProviderTokenToHostedProfile } from '@/services/github-auth';
import { invalidateMercuryResourceCache } from '@/services/mercury';
import { syncPendingMercuryReferralClick } from '@/services/mercury-referrals';
import { getSupabaseSession, onSupabaseAuthStateChange } from '@/services/supabase-client';
import { ensureTourDemoData } from '@/services/tour-demo';
import { useAppearanceUiStore } from '@/stores/appearance-store';
import { useAuthUiStore } from '@/stores/auth-ui-store';
import { AppThemeProvider } from '@/theme/provider';
import {
  loadTime2PayOnboardingGateSnapshot,
  syncPendingTime2PayOnboardingProgress,
} from '@/features/onboarding/onboarding-state';
import { resolveHostedRouteGate } from '@/features/onboarding/onboarding-route-gate';
export const unstable_settings = {
  anchor: 'index',
};

const AUTH_BOOTSTRAP_TIMEOUT_MS = 5000;

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  try {
    useAppearanceUiStore.getState().hydrateAppearancePreference();
  } catch {
    // no-op
  }
}

if (Platform.OS !== 'web') {
  LogBox.ignoreLogs([
    /Invalid Refresh Token/i,
    /Refresh Token Not Found/i,
    /AuthSessionMissingError/i,
  ]);
}

export default function RootLayout() {
  const hostedMode = isHostedMode();
  const pathname = usePathname();
  const segments = useSegments();
  const router = useRouter();
  const appearancePreference = useAppearanceUiStore((state) => state.appearancePreference);
  const hydrateAppearancePreference = useAppearanceUiStore((state) => state.hydrateAppearancePreference);
  const { theme: resolvedAppearanceTheme } = useUniwind();
  const isDark = resolvedAppearanceTheme === 'dark';
  const isLandingEntry = pathname === '/';

  const authReady = useAuthUiStore((state) => state.authReady);
  const isAuthenticated = useAuthUiStore((state) => state.isAuthenticated);
  const onboardingGateReady = useAuthUiStore((state) => state.onboardingGateReady);
  const onboardingGateStatus = useAuthUiStore((state) => state.onboardingGateStatus);
  const onboardingGateError = useAuthUiStore((state) => state.onboardingGateError);
  const hostedAccessGateReady = useAuthUiStore((state) => state.hostedAccessGateReady);
  const hostedAccessGateStatus = useAuthUiStore((state) => state.hostedAccessGateStatus);
  const hostedAccessGateError = useAuthUiStore((state) => state.hostedAccessGateError);
  const hostedAccessEnforcementEnabled = useAuthUiStore(
    (state) => state.hostedAccessEnforcementEnabled,
  );
  const hostedAccessHasAccess = useAuthUiStore((state) => state.hostedAccessHasAccess);
  const tourModeEnabled = useAuthUiStore((state) => state.tourModeEnabled);
  const tourModeHydrated = useAuthUiStore((state) => state.tourModeHydrated);
  const setTourInitError = useAuthUiStore((state) => state.setTourInitError);
  const setOnboardingGateChecking = useAuthUiStore((state) => state.setOnboardingGateChecking);
  const syncOnboardingGate = useAuthUiStore((state) => state.syncOnboardingGate);
  const setOnboardingGateError = useAuthUiStore((state) => state.setOnboardingGateError);
  const resetOnboardingGate = useAuthUiStore((state) => state.resetOnboardingGate);
  const setHostedAccessGateChecking = useAuthUiStore(
    (state) => state.setHostedAccessGateChecking,
  );
  const syncHostedAccessGate = useAuthUiStore((state) => state.syncHostedAccessGate);
  const setHostedAccessGateError = useAuthUiStore((state) => state.setHostedAccessGateError);
  const resetHostedAccessGate = useAuthUiStore((state) => state.resetHostedAccessGate);
  const hydrateTourMode = useAuthUiStore((state) => state.hydrateTourMode);
  const syncHostedAuth = useAuthUiStore((state) => state.syncHostedAuth);
  const resetForLocalMode = useAuthUiStore((state) => state.resetForLocalMode);
  const [isTourSeedReady, setIsTourSeedReady] = useState(!tourModeEnabled);
  const appAccessMode = resolveAppAccessMode(hostedMode ? 'hosted' : 'local', tourModeEnabled);

  useEffect(() => {
    bootstrapRuntimeDiagnostics();
    logRuntimeDiagnostic('root.layout.mounted', {
      hostedMode,
      pathname,
      segments,
    });
  }, [hostedMode, pathname, segments]);

  useEffect(() => {
    logRuntimeDiagnostic('data.provider.selected', {
      appAccessMode,
      provider:
        appAccessMode === 'tour'
          ? 'tour-memory'
          : appAccessMode === 'hosted'
            ? 'hosted-supabase'
            : 'local-sqlite',
    });
  }, [appAccessMode]);

  useEffect(() => {
    if (!hostedMode) {
      return;
    }

    const missingEnvKeys = getMissingHostedModePublicEnvKeys();
    if (missingEnvKeys.length > 0) {
      logRuntimeDiagnostic(
        'hosted.config.missingEnv',
        {
          missingEnvKeys,
          requiredEnvKeys: HOSTED_MODE_REQUIRED_PUBLIC_ENV_KEYS,
        },
        { level: 'error' },
      );
      return;
    }

    logRuntimeDiagnostic('hosted.config.ready', {
      requiredEnvKeys: HOSTED_MODE_REQUIRED_PUBLIC_ENV_KEYS,
    });
  }, [hostedMode]);

  useEffect(() => {
    hydrateAppearancePreference();
  }, [hydrateAppearancePreference]);

  useEffect(() => {
    logRuntimeDiagnostic('auth.tourMode.hydrate.start');
    hydrateTourMode();
  }, [hydrateTourMode]);

  useEffect(() => {
    if (!hostedMode) {
      logRuntimeDiagnostic('auth.bootstrap.localMode.reset');
      resetForLocalMode();
      return;
    }

    let isActive = true;
    let authBootstrapTimeoutId: ReturnType<typeof setTimeout> | undefined;
    let authStateObserved = false;
    const syncGitHubProviderToken = (
      session: Awaited<ReturnType<typeof getSupabaseSession>>,
      source: 'bootstrap' | 'auth-state',
    ): void => {
      syncGitHubProviderTokenToHostedProfile(session)
        .then((status) => {
          if (status === 'skipped') {
            return;
          }

          logRuntimeDiagnostic('auth.githubToken.sync', {
            source,
            status,
            hasSessionUser: Boolean(session?.user),
          });
        })
        .catch((error) => {
          logRuntimeDiagnostic(
            'auth.githubToken.sync.error',
            {
              source,
              message: errorMessage(error),
            },
            { level: 'warn' },
          );
        });
    };
    logRuntimeDiagnostic('auth.bootstrap.session.read.start', {
      hostedMode,
    });

    const sessionRead = Promise.race([
      getSupabaseSession().then((session) => ({
        status: 'resolved' as const,
        session,
      })),
      new Promise<{ status: 'timeout' }>((resolve) => {
        authBootstrapTimeoutId = setTimeout(
          () => resolve({ status: 'timeout' }),
          AUTH_BOOTSTRAP_TIMEOUT_MS,
        );
      }),
    ]);

    sessionRead
      .then((result) => {
        if (!isActive) {
          return;
        }

        clearTimeout(authBootstrapTimeoutId);

        if (result.status === 'timeout') {
          if (authStateObserved) {
            logRuntimeDiagnostic('auth.bootstrap.session.read.timeout.ignored', {
              reason: 'auth-state-already-observed',
              timeoutMs: AUTH_BOOTSTRAP_TIMEOUT_MS,
            });
            return;
          }

          logRuntimeDiagnostic(
            'auth.bootstrap.session.read.timeout',
            {
              timeoutMs: AUTH_BOOTSTRAP_TIMEOUT_MS,
            },
            { level: 'warn' },
          );
          syncHostedAuth({
            ready: true,
            authenticated: false,
          });
          return;
        }

        logRuntimeDiagnostic('auth.bootstrap.session.read.success', {
          hasSessionUser: Boolean(result.session?.user),
        });
        syncGitHubProviderToken(result.session, 'bootstrap');
        syncHostedAuth({
          ready: true,
          authenticated: Boolean(result.session?.user),
        });
      })
      .catch((error) => {
        if (!isActive) {
          return;
        }

        clearTimeout(authBootstrapTimeoutId);

        logRuntimeDiagnostic(
          'auth.bootstrap.session.read.error',
          {
            message: errorMessage(error),
          },
          { level: 'error' },
        );
        syncHostedAuth({
          ready: true,
          authenticated: false,
        });
      });

    const unsubscribe = onSupabaseAuthStateChange((event, session) => {
      if (!isActive) {
        return;
      }

      authStateObserved = true;
      logRuntimeDiagnostic('auth.bootstrap.state.changed', {
        event,
        hasSessionUser: Boolean(session?.user),
      });
      invalidateMercuryResourceCache();
      syncGitHubProviderToken(session, 'auth-state');
      syncHostedAuth({
        ready: true,
        authenticated: Boolean(session?.user),
      });
    });

    return () => {
      isActive = false;
      clearTimeout(authBootstrapTimeoutId);
      logRuntimeDiagnostic('auth.bootstrap.cleanup');
      unsubscribe();
    };
  }, [hostedMode, resetForLocalMode, syncHostedAuth]);

  useEffect(() => {
    if (!hostedMode || !authReady || !isAuthenticated) {
      return;
    }

    syncPendingMercuryReferralClick().catch((error) => {
      logRuntimeDiagnostic(
        'mercury.referral.pendingSync.error',
        {
          message: errorMessage(error),
        },
        { level: 'warn' },
      );
    });
  }, [authReady, hostedMode, isAuthenticated]);

  useEffect(() => {
    if (!hostedMode || tourModeEnabled) {
      resetOnboardingGate();
      return;
    }

    if (!authReady) {
      return;
    }

    if (!isAuthenticated) {
      resetOnboardingGate();
      return;
    }

    let isActive = true;
    setOnboardingGateChecking();
    logRuntimeDiagnostic('onboarding.gate.load.start');

    syncPendingTime2PayOnboardingProgress()
      .then(() => loadTime2PayOnboardingGateSnapshot())
      .then((snapshot) => {
        if (!isActive) {
          return;
        }

        logRuntimeDiagnostic('onboarding.gate.load.success', {
          status: snapshot.status,
          completedStepIds: snapshot.completedStepIds,
          missingDocumentIds: snapshot.missingDocumentIds,
        });
        syncOnboardingGate({
          status: snapshot.status,
          completedStepIds: snapshot.completedStepIds,
          missingLegalDocumentIds: snapshot.missingDocumentIds,
        });
      })
      .catch((error) => {
        if (!isActive) {
          return;
        }

        const message = errorMessage(error);
        logRuntimeDiagnostic(
          'onboarding.gate.load.error',
          {
            message,
          },
          { level: 'error' },
        );
        setOnboardingGateError(message);
      });

    return () => {
      isActive = false;
    };
  }, [
    authReady,
    hostedMode,
    isAuthenticated,
    resetOnboardingGate,
    setOnboardingGateChecking,
    setOnboardingGateError,
    syncOnboardingGate,
    tourModeEnabled,
  ]);

  useEffect(() => {
    if (
      !hostedMode ||
      tourModeEnabled ||
      !authReady ||
      !isAuthenticated ||
      !onboardingGateReady ||
      onboardingGateStatus !== 'complete'
    ) {
      resetHostedAccessGate();
      return;
    }

    let isActive = true;
    const abortController = new AbortController();

    setHostedAccessGateChecking();
    logRuntimeDiagnostic('hosted.access.gate.load.start');

    getHostedBillingStatus(abortController.signal)
      .then((hostedAccess) => {
        if (!isActive) {
          return;
        }

        const enforcementEnabled = hostedAccess.enforcementEnabled === true;
        const status = !enforcementEnabled || hostedAccess.hasAccess ? 'allowed' : 'blocked';

        logRuntimeDiagnostic('hosted.access.gate.load.success', {
          enforcementEnabled,
          hasAccess: hostedAccess.hasAccess,
          source: hostedAccess.source,
          status: hostedAccess.status,
          routeGateStatus: status,
        });
        syncHostedAccessGate({
          enforcementEnabled,
          hasAccess: hostedAccess.hasAccess,
          status,
        });
      })
      .catch((error) => {
        if (!isActive || abortController.signal.aborted) {
          return;
        }

        const message = errorMessage(error);
        logRuntimeDiagnostic(
          'hosted.access.gate.load.error',
          {
            message,
          },
          { level: 'error' },
        );
        setHostedAccessGateError(message);
      });

    return () => {
      isActive = false;
      abortController.abort();
    };
  }, [
    authReady,
    hostedMode,
    isAuthenticated,
    onboardingGateReady,
    onboardingGateStatus,
    resetHostedAccessGate,
    setHostedAccessGateChecking,
    setHostedAccessGateError,
    syncHostedAccessGate,
    tourModeEnabled,
  ]);

  useEffect(() => {
    let isActive = true;

    if (appAccessMode !== 'tour') {
      setIsTourSeedReady(true);
      setTourInitError(null);
      logRuntimeDiagnostic('tour.seed.skipped', {
        hostedMode,
        appAccessMode,
      });
      return () => {
        isActive = false;
      };
    }

    setIsTourSeedReady(false);
    setTourInitError(null);
    logRuntimeDiagnostic('tour.seed.start', {
      appAccessMode,
    });

    ensureTourDemoData()
      .catch((error) => {
        logRuntimeDiagnostic(
          'tour.seed.error',
          {
            message: errorMessage(error),
          },
          { level: 'error' },
        );
        console.error('Failed to seed tour demo data:', error);
        setTourInitError('Tour data failed to initialize. Try "Reset Tour" or refresh the page.');
      })
      .finally(() => {
        if (isActive) {
          logRuntimeDiagnostic('tour.seed.ready');
          setIsTourSeedReady(true);
        }
      });

    return () => {
      isActive = false;
    };
  }, [appAccessMode, hostedMode, setTourInitError]);

  const routeGate = resolveHostedRouteGate({
    authReady,
    hostedAccessGateReady,
    hostedAccessGateStatus,
    hostedMode,
    isAuthenticated,
    isTourSeedReady,
    onboardingGateReady,
    onboardingGateStatus,
    pathname,
    tourModeEnabled,
    tourModeHydrated,
  });

  useEffect(() => {
    logRuntimeDiagnostic('auth.redirect.check', {
      canAccessAccountRoutes: routeGate.canAccessAccountRoutes,
      canAccessAppRoutes: routeGate.canAccessAppRoutes,
      canMountAccountRoutes: routeGate.canMountAccountRoutes,
      canMountAppRoutes: routeGate.canMountAppRoutes,
      hostedAccessEnforcementEnabled,
      hostedAccessGateError,
      hostedAccessGateReady,
      hostedAccessGateStatus,
      hostedAccessHasAccess,
      isAccountRoute: routeGate.isAccountRoute,
      isAppRoute: routeGate.isAppRoute,
      isAuthenticated,
      onboardingGateError,
      onboardingGateReady,
      onboardingGateStatus,
      pathname,
      redirectTarget: routeGate.redirectTarget,
      shouldShowLoadingShell: routeGate.shouldShowLoadingShell,
      tourModeEnabled,
    });

    if (routeGate.redirectTarget) {
      logRuntimeDiagnostic(
        'auth.redirect.toOnboardingGateTarget',
        {
          redirectTarget: routeGate.redirectTarget,
        },
        { level: 'warn' },
      );
      router.replace(routeGate.redirectTarget as never);
      return;
    }
  }, [
    hostedAccessEnforcementEnabled,
    hostedAccessGateError,
    hostedAccessGateReady,
    hostedAccessGateStatus,
    hostedAccessHasAccess,
    isAuthenticated,
    onboardingGateError,
    onboardingGateReady,
    onboardingGateStatus,
    pathname,
    routeGate.canAccessAccountRoutes,
    routeGate.canAccessAppRoutes,
    routeGate.canMountAccountRoutes,
    routeGate.canMountAppRoutes,
    routeGate.isAccountRoute,
    routeGate.isAppRoute,
    routeGate.redirectTarget,
    routeGate.shouldShowLoadingShell,
    router,
    tourModeEnabled,
  ]);

  const isLoadingShellVisible = hostedMode && routeGate.shouldShowLoadingShell;

  useEffect(() => {
    if (isLoadingShellVisible) {
      logRuntimeDiagnostic('root.loadingShell.visible', {
        hostedMode,
        hostedAccessEnforcementEnabled,
        hostedAccessGateError,
        hostedAccessGateReady,
        hostedAccessGateStatus,
        hostedAccessHasAccess,
        authReady,
        appAccessMode,
        isTourSeedReady,
        isAccountRoute: routeGate.isAccountRoute,
        isAppRoute: routeGate.isAppRoute,
        onboardingGateReady,
        onboardingGateStatus,
        tourModeHydrated,
      });
    }
  }, [
    appAccessMode,
    authReady,
    hostedAccessEnforcementEnabled,
    hostedAccessGateError,
    hostedAccessGateReady,
    hostedAccessGateStatus,
    hostedAccessHasAccess,
    hostedMode,
    isTourSeedReady,
    isLoadingShellVisible,
    onboardingGateReady,
    onboardingGateStatus,
    routeGate.isAccountRoute,
    routeGate.isAppRoute,
    tourModeHydrated,
  ]);

  return (
    <AppThemeProvider scheme={appearancePreference}>
      {isLandingEntry ? <LandingSeoHead /> : <NoIndexSeoHead />}
      <Stack
        screenOptions={{
          headerShown: false,
          headerStyle: { backgroundColor: isDark ? '#1a1f16' : '#f8f7f3' },
          headerTintColor: isDark ? '#f8f7f3' : '#1a1f16',
          contentStyle: { backgroundColor: isDark ? '#1a1f16' : '#f8f7f3' },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Time2Pay' }} />
        <Stack.Screen name="privacy" options={{ title: 'Privacy Policy' }} />
        <Stack.Screen name="terms" options={{ title: 'Terms of Service' }} />
        <Stack.Screen name="legal/updates" options={{ title: 'Legal Updates' }} />
        <Stack.Screen name="sign-in" options={{ title: 'Sign In' }} />
        <Stack.Screen name="pricing" options={{ title: 'Hosted Pricing' }} />
        <Stack.Screen name="onboarding" options={{ title: 'Time2Pay Onboarding' }} />
        <Stack.Screen name="onboarding/features" options={{ title: 'Time2Pay Features' }} />
        <Stack.Screen name="onboarding/auth" options={{ title: 'Time2Pay Account' }} />
        <Stack.Screen name="onboarding/legal" options={{ title: 'Time2Pay Legal' }} />
        <Stack.Protected guard={routeGate.canMountAccountRoutes}>
          <Stack.Screen name="settings" options={{ title: 'Settings' }} />
          <Stack.Screen name="access-required" options={{ title: 'Hosted Access' }} />
          <Stack.Screen name="referral-status" options={{ title: 'Mercury Referral' }} />
          <Stack.Screen name="settings/billing" options={{ title: 'Billing' }} />
          <Stack.Screen name="settings/integrations" options={{ title: 'Integrations' }} />
        </Stack.Protected>
        <Stack.Protected guard={routeGate.canMountAppRoutes}>
          <Stack.Screen name="(tabs)" options={{ title: 'Time2Pay' }} />
        </Stack.Protected>
        <Stack.Screen name="+not-found" options={{ title: 'Not Found' }} />
      </Stack>
      {isLoadingShellVisible ? (
        <View
          style={[StyleSheet.absoluteFill, { pointerEvents: 'auto', zIndex: 9999, elevation: 9999 }]}
        >
          <AppLoadingShell />
        </View>
      ) : null}
    </AppThemeProvider>
  );
}
