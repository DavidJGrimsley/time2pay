import { Stack, usePathname, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { AppLoadingShell } from '@/components/app-loading-shell';
import { useResolvedDataMode } from '@/hooks/use-resolved-data-mode';
import { isProfileComplete } from '@/services/profile-completion';
import { useAuthUiStore } from '@/stores/auth-ui-store';

const MIN_PROFILE_CHECK_MS = 220;

export default function TabsLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const { hostedMode, resolved: dataModeResolved } = useResolvedDataMode();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const isProfileRoute = pathname === '/profile' || pathname.endsWith('/profile');

  const isAuthenticated = useAuthUiStore((state) => state.isAuthenticated);
  const tourModeEnabled = useAuthUiStore((state) => state.tourModeEnabled);

  const shouldRequireProfileCompletion = dataModeResolved && !tourModeEnabled && (!hostedMode || isAuthenticated);
  const [isProfileGateReady, setIsProfileGateReady] = useState(!dataModeResolved || !shouldRequireProfileCompletion);

  useEffect(() => {
    let isActive = true;

    if (!dataModeResolved) {
      setIsProfileGateReady(false);
      return () => {
        isActive = false;
      };
    }

    if (!shouldRequireProfileCompletion) {
      setIsProfileGateReady(true);
      return () => {
        isActive = false;
      };
    }

    setIsProfileGateReady(false);

    const checkProfileGate = async () => {
      const minimumDelay = new Promise((resolve) => {
        setTimeout(resolve, MIN_PROFILE_CHECK_MS);
      });

      try {
        const [complete] = await Promise.all([isProfileComplete(), minimumDelay]);
        if (!isActive) {
          return;
        }

        if (!complete && !isProfileRoute) {
          router.replace('/profile');
        }
      } catch {
        if (!isActive) {
          return;
        }

        if (!isProfileRoute) {
          router.replace('/profile');
        }
      } finally {
        if (isActive) {
          setIsProfileGateReady(true);
        }
      }
    };

    checkProfileGate().catch(() => {
      if (isActive) {
        setIsProfileGateReady(true);
      }
    });

    return () => {
      isActive = false;
    };
  }, [dataModeResolved, isProfileRoute, router, shouldRequireProfileCompletion]);

  if (!dataModeResolved || !isProfileGateReady) {
    return <AppLoadingShell />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: isDark ? '#1a1f16' : '#f8f7f3' },
        headerTintColor: isDark ? '#f8f7f3' : '#1a1f16',
        contentStyle: { backgroundColor: isDark ? '#1a1f16' : '#f8f7f3' },
      }}
    >
      <Stack.Screen name="dashboard" options={{ title: 'Dashboard' }} />
      <Stack.Screen name="sessions" options={{ title: 'Sessions' }} />
      <Stack.Screen name="projects" options={{ title: 'Projects' }} />
      <Stack.Screen name="invoices" options={{ title: 'Invoices' }} />
      <Stack.Screen name="bank" options={{ title: 'Bank' }} />
      <Stack.Screen name="payments" options={{ title: 'Payments' }} />
      <Stack.Screen name="profile" options={{ title: 'Profile' }} />
    </Stack>
  );
}

