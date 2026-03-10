import { Stack, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { Uniwind } from 'uniwind';
import { AppLoadingShell } from '@/components/app-loading-shell';
import { LandingSeoHead } from '@/components/landing/landing-seo-head';
import { isProfileComplete } from '@/services/profile-completion';
import '../../global.css';

const MIN_BOOTSTRAP_MS = 420;

export const unstable_settings = {
  anchor: 'dashboard',
};

// Web: apply system theme ASAP (before first paint) to avoid light→dark flash.
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  try {
    Uniwind.setTheme('system');
  } catch {
    // no-op
  }
}

export default function RootLayout() {
  const pathname = usePathname();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [isGateReady, setIsGateReady] = useState(false);
  const [profileComplete, setProfileComplete] = useState(false);
  const isLandingEntry = pathname === '/';

  // Native: sync Uniwind with OS appearance.
  useEffect(() => {
    Uniwind.setTheme('system');
  }, []);

  useEffect(() => {
    let isActive = true;

    const bootstrapApp = async () => {
      const minimumDelay = new Promise((resolve) => {
        setTimeout(resolve, MIN_BOOTSTRAP_MS);
      });

      try {
        const [complete] = await Promise.all([isProfileComplete(), minimumDelay]);

        if (!isActive) {
          return;
        }

        setProfileComplete(complete);
      } catch {
        if (!isActive) {
          return;
        }

        setProfileComplete(false);
      } finally {
        if (!isActive) {
          return;
        }

        setIsGateReady(true);
      }
    };

    bootstrapApp().catch(() => {
      if (!isActive) {
        return;
      }

      setProfileComplete(false);
      setIsGateReady(true);
    });

    return () => {
      isActive = false;
    };
  }, []);

  if (!isGateReady) {
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
        <Stack.Protected guard={!profileComplete}>
          <Stack.Screen name="index" options={{ title: 'Time2Pay' }} />
        </Stack.Protected>
        <Stack.Screen name="dashboard" options={{ title: 'Dashboard' }} />
        <Stack.Screen name="sessions" options={{ title: 'Sessions' }} />
        <Stack.Screen name="invoices" options={{ title: 'Invoices' }} />
        <Stack.Screen name="bank" options={{ title: 'Bank' }} />
        <Stack.Screen name="profile" options={{ title: 'Profile' }} />
        <Stack.Screen name="+not-found" options={{ title: 'Not Found' }} />
      </Stack>
    </>
  );
}
