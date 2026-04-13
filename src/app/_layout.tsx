import { Stack, usePathname, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, useColorScheme } from 'react-native';
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
import { getSupabaseSession, onSupabaseAuthStateChange } from '@/services/supabase-client';
import { ensureTourDemoData } from '@/services/tour-demo';
import { useAuthUiStore } from '@/stores/auth-ui-store';
import '../../global.css';

export const unstable_settings = {
  anchor: 'index',
};

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  try {
    Uniwind.setTheme('system');
  } catch {
    // no-op
  }
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
  const tourModeEnabled = useAuthUiStore((state) => state.tourModeEnabled);
  const tourModeHydrated = useAuthUiStore((state) => state.tourModeHydrated);
  const setTourInitError = useAuthUiStore((state) => state.setTourInitError);
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
    logRuntimeDiagnostic('auth.bootstrap.session.read.start', {
      hostedMode,
    });

    getSupabaseSession()
      .then((session) => {
        if (!isActive) {
          return;
        }

        logRuntimeDiagnostic('auth.bootstrap.session.read.success', {
          hasSessionUser: Boolean(session?.user),
        });
        syncHostedAuth({
          ready: true,
          authenticated: Boolean(session?.user),
        });
      })
      .catch((error) => {
        if (!isActive) {
          return;
        }

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

      logRuntimeDiagnostic('auth.bootstrap.state.changed', {
        event,
        hasSessionUser: Boolean(session?.user),
      });
      syncHostedAuth({
        ready: true,
        authenticated: Boolean(session?.user),
      });
    });

    return () => {
      isActive = false;
      logRuntimeDiagnostic('auth.bootstrap.cleanup');
      unsubscribe();
    };
  }, [hostedMode, resetForLocalMode, syncHostedAuth]);

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
  const hostedAccessResolved = tourModeHydrated && authReady;
  const canAccessTabs = !hostedMode || !hostedAccessResolved || isAuthenticated || tourModeEnabled;
  const normalizedPathname = pathname !== '/' ? pathname.replace(/\/+$/, '') : pathname;
  const isPublicRoute =
    normalizedPathname === '/' ||
    normalizedPathname === '/sign-in' ||
    normalizedPathname === '/privacy' ||
    normalizedPathname === '/terms';
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

    logRuntimeDiagnostic('auth.redirect.check', {
      canAccessTabs,
      hostedAccessResolved,
      isInsideTabsGroup,
      isAuthenticated,
      pathname,
      tourModeEnabled,
    });

    if (!canAccessTabs && isInsideTabsGroup) {
      logRuntimeDiagnostic(
        'auth.redirect.to.signIn',
        {
          reason: 'tabs-guard-blocked',
        },
        { level: 'warn' },
      );
      router.replace('/sign-in' as never);
      return;
    }

    if (isAuthenticated && pathname === '/sign-in') {
      logRuntimeDiagnostic('auth.redirect.to.dashboard', {
        reason: 'already-authenticated',
      });
      router.replace('/dashboard');
    }
  }, [
    authReady,
    canAccessTabs,
    hostedAccessResolved,
    hostedMode,
    isAuthenticated,
    isInsideTabsGroup,
    pathname,
    router,
    tourModeEnabled,
    tourModeHydrated,
  ]);

  const isLoadingShellVisible =
    hostedMode &&
    (!tourModeHydrated || !authReady || (appAccessMode === 'tour' && !isTourSeedReady));

  useEffect(() => {
    if (isLoadingShellVisible) {
      logRuntimeDiagnostic('root.loadingShell.visible', {
        hostedMode,
        hostedAccessResolved,
        tourModeHydrated,
        authReady,
        appAccessMode,
        isTourSeedReady,
      });
    }
  }, [isLoadingShellVisible, hostedMode, hostedAccessResolved, tourModeHydrated, authReady, appAccessMode, isTourSeedReady]);

  if (isLoadingShellVisible) {
    return (
      <>
        {isLandingEntry ? <LandingSeoHead /> : <NoIndexSeoHead />}
        <AppLoadingShell />
      </>
    );
  }

  return (
    <>
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
        <Stack.Screen name="sign-in" options={{ title: 'Sign In' }} />
        <Stack.Protected guard={canAccessTabs}>
          <Stack.Screen name="(tabs)" options={{ title: 'Time2Pay' }} />
        </Stack.Protected>
        <Stack.Screen name="+not-found" options={{ title: 'Not Found' }} />
      </Stack>
    </>
  );
}
