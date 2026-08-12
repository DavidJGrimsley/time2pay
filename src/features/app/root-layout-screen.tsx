import { Stack, usePathname, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { LogBox, Platform, StyleSheet, useColorScheme, View } from 'react-native';
import { Uniwind } from 'uniwind';
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
import { syncGitHubProviderTokenToHostedProfile } from '@/services/github-auth';
import { invalidateMercuryResourceCache } from '@/services/mercury';
import { syncPendingMercuryReferralClick } from '@/services/mercury-referrals';
import { getSupabaseSession, onSupabaseAuthStateChange } from '@/services/supabase-client';
import { ensureTourDemoData } from '@/services/tour-demo';
import { useAuthUiStore } from '@/stores/auth-ui-store';
import { AppThemeProvider } from '@/theme/provider';
import {
  loadTime2PayOnboardingGateSnapshot,
  syncPendingTime2PayOnboardingProgress,
} from '@/features/onboarding/onboarding-state';
import { resolveHostedOnboardingRedirect } from '@/features/onboarding/onboarding-route-gate';
export const unstable_settings = {
  anchor: 'index',
};

const AUTH_BOOTSTRAP_TIMEOUT_MS = 5000;
type HostedAccessState = 'checking' | 'allowed' | 'blocked';

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  try {
    Uniwind.setTheme('system');
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
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const isLandingEntry = pathname === '/';

  const authReady = useAuthUiStore((state) => state.authReady);
  const isAuthenticated = useAuthUiStore((state) => state.isAuthenticated);
  const onboardingGateReady = useAuthUiStore((state) => state.onboardingGateReady);
  const onboardingGateStatus = useAuthUiStore((state) => state.onboardingGateStatus);
  const onboardingGateError = useAuthUiStore((state) => state.onboardingGateError);
  const tourModeEnabled = useAuthUiStore((state) => state.tourModeEnabled);
  const tourModeHydrated = useAuthUiStore((state) => state.tourModeHydrated);
  const setTourInitError = useAuthUiStore((state) => state.setTourInitError);
  const setOnboardingGateChecking = useAuthUiStore((state) => state.setOnboardingGateChecking);
  const syncOnboardingGate = useAuthUiStore((state) => state.syncOnboardingGate);
  const setOnboardingGateError = useAuthUiStore((state) => state.setOnboardingGateError);
  const resetOnboardingGate = useAuthUiStore((state) => state.resetOnboardingGate);
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
    Uniwind.setTheme('system');
  }, []);

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
    let isActive = true;

    if (!hostedMode || appAccessMode !== 'tour') {
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

  // Keep tabs reachable while hosted auth/tour state is still bootstrapping so
  // first-click tour navigation can land on the loading shell instead of
  // bouncing back to the public landing route.
  const hostedAccessState: HostedAccessState = !hostedMode
    ? 'allowed'
    : !tourModeHydrated || !authReady
      ? 'checking'
      : isAuthenticated || tourModeEnabled
        ? 'allowed'
        : 'blocked';
  const hostedAccessResolved = hostedAccessState !== 'checking';
  const onboardingGateRequired = hostedMode && isAuthenticated && !tourModeEnabled;
  const onboardingGateAllowsTabs =
    !onboardingGateRequired || !onboardingGateReady || onboardingGateStatus === 'complete';
  const canAccessTabs = hostedAccessState !== 'blocked' && onboardingGateAllowsTabs;
  const normalizedPathname = pathname !== '/' ? pathname.replace(/\/+$/, '') : pathname;
  const isOnboardingRoute =
    normalizedPathname === '/onboarding' || normalizedPathname.startsWith('/onboarding/');
  const isLegalUpdateRoute = normalizedPathname === '/legal/updates';
  const isPublicRoute =
    normalizedPathname === '/' ||
    normalizedPathname === '/sign-in' ||
    normalizedPathname === '/pricing' ||
    normalizedPathname === '/privacy' ||
    normalizedPathname === '/terms' ||
    isLegalUpdateRoute ||
    isOnboardingRoute;
  const isInsideTabsGroup = !isPublicRoute;

  useEffect(() => {
    if (!hostedMode || !tourModeHydrated || !authReady) {
      logRuntimeDiagnostic('auth.redirect.check.skipped', {
        hostedMode,
        tourModeHydrated,
        authReady,
      });
      return;
    }

    const redirectTarget = resolveHostedOnboardingRedirect({
      authReady,
      hostedMode,
      isAuthenticated,
      isInsideTabsGroup,
      onboardingGateReady,
      onboardingGateStatus,
      pathname,
      tourModeEnabled,
      tourModeHydrated,
    });

    logRuntimeDiagnostic('auth.redirect.check', {
      canAccessTabs,
      hostedAccessState,
      hostedAccessResolved,
      isInsideTabsGroup,
      isAuthenticated,
      onboardingGateError,
      onboardingGateReady,
      onboardingGateStatus,
      pathname,
      redirectTarget,
      tourModeEnabled,
    });

    if (redirectTarget) {
      logRuntimeDiagnostic(
        'auth.redirect.toOnboardingGateTarget',
        {
          redirectTarget,
        },
        { level: 'warn' },
      );
      router.replace(redirectTarget as never);
      return;
    }
  }, [
    authReady,
    canAccessTabs,
    hostedAccessState,
    hostedAccessResolved,
    hostedMode,
    isAuthenticated,
    isInsideTabsGroup,
    onboardingGateError,
    onboardingGateReady,
    onboardingGateStatus,
    pathname,
    router,
    tourModeEnabled,
    tourModeHydrated,
  ]);

  const isLoadingShellVisible =
    hostedMode &&
    (hostedAccessState === 'checking' ||
      (appAccessMode === 'tour' && !isTourSeedReady) ||
      (onboardingGateRequired && !onboardingGateReady));

  useEffect(() => {
    if (isLoadingShellVisible) {
      logRuntimeDiagnostic('root.loadingShell.visible', {
        hostedMode,
        hostedAccessState,
        hostedAccessResolved,
        tourModeHydrated,
        authReady,
        appAccessMode,
        isTourSeedReady,
        onboardingGateReady,
        onboardingGateRequired,
        onboardingGateStatus,
      });
    }
  }, [
    isLoadingShellVisible,
    hostedMode,
    hostedAccessState,
    hostedAccessResolved,
    tourModeHydrated,
    authReady,
    appAccessMode,
    isTourSeedReady,
    onboardingGateReady,
    onboardingGateRequired,
    onboardingGateStatus,
  ]);

  return (
    <AppThemeProvider>
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
        <Stack.Protected guard={canAccessTabs}>
          <Stack.Screen name="(tabs)" options={{ title: 'Time2Pay' }} />
          <Stack.Screen name="access-required" options={{ title: 'Hosted Access' }} />
          <Stack.Screen name="referral-status" options={{ title: 'Mercury Referral' }} />
          <Stack.Screen name="settings/billing" options={{ title: 'Billing' }} />
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
