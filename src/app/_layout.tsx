import { Stack, usePathname, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { Uniwind } from 'uniwind';
import { AppLoadingShell } from '@/components/app-loading-shell';
import { LandingSeoHead } from '@/components/landing/landing-seo-head';
import { isHostedMode } from '@/services/runtime-mode';
import { getSupabaseSession, onSupabaseAuthStateChange } from '@/services/supabase-client';
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
  const syncHostedAuth = useAuthUiStore((state) => state.syncHostedAuth);
  const resetForLocalMode = useAuthUiStore((state) => state.resetForLocalMode);

  useEffect(() => {
    Uniwind.setTheme('system');
  }, []);

  useEffect(() => {
    if (!hostedMode) {
      resetForLocalMode();
      return;
    }

    let isActive = true;

    getSupabaseSession()
      .then((session) => {
        if (!isActive) {
          return;
        }

        syncHostedAuth({
          ready: true,
          authenticated: Boolean(session?.user),
        });
      })
      .catch(() => {
        if (!isActive) {
          return;
        }

        syncHostedAuth({
          ready: true,
          authenticated: false,
        });
      });

    const unsubscribe = onSupabaseAuthStateChange((_, session) => {
      if (!isActive) {
        return;
      }

      syncHostedAuth({
        ready: true,
        authenticated: Boolean(session?.user),
      });
    });

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, [hostedMode, resetForLocalMode, syncHostedAuth]);

  const canAccessTabs = !hostedMode || isAuthenticated || tourModeEnabled;
  const isInsideTabsGroup = segments[0] === '(tabs)';

  useEffect(() => {
    if (!hostedMode || !authReady) {
      return;
    }

    if (!canAccessTabs && isInsideTabsGroup) {
      router.replace('/sign-in');
      return;
    }

    if (isAuthenticated && pathname === '/sign-in') {
      router.replace('/dashboard');
    }
  }, [authReady, canAccessTabs, hostedMode, isAuthenticated, isInsideTabsGroup, pathname, router]);

  if (hostedMode && !authReady) {
    return (
      <>
        {isLandingEntry ? <LandingSeoHead /> : null}
        <AppLoadingShell />
      </>
    );
  }

  return (
    <>
      {isLandingEntry ? <LandingSeoHead /> : null}
      <Stack
        screenOptions={{
          headerShown: false,
          headerStyle: { backgroundColor: isDark ? '#1a1f16' : '#f8f7f3' },
          headerTintColor: isDark ? '#f8f7f3' : '#1a1f16',
          contentStyle: { backgroundColor: isDark ? '#1a1f16' : '#f8f7f3' },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Time2Pay' }} />
        <Stack.Screen name="sign-in" options={{ title: 'Sign In' }} />
        <Stack.Protected guard={canAccessTabs}>
          <Stack.Screen name="(tabs)" options={{ title: 'Time2Pay' }} />
        </Stack.Protected>
        <Stack.Screen name="+not-found" options={{ title: 'Not Found' }} />
      </Stack>
    </>
  );
}