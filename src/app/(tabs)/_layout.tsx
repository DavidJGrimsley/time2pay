import { Stack, usePathname, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';
import { AppLoadingShell } from '@/components/app-loading-shell';
import { useResolvedDataMode } from '@/hooks/use-resolved-data-mode';
import { getProfileCompletion } from '@/services/profile-completion';
import { useAuthUiStore } from '@/stores/auth-ui-store';

export default function TabsLayout() {
  const pathname = usePathname();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { hostedMode, resolved: dataModeResolved } = useResolvedDataMode();
  const tourModeEnabled = useAuthUiStore((state) => state.tourModeEnabled);
  const shouldBypassProfileGate = dataModeResolved && hostedMode && tourModeEnabled;
  const normalizedPathname = pathname !== '/' ? pathname.replace(/\/+$/, '') : pathname;
  const isProfileRoute = normalizedPathname === '/profile';
  const [profileGateReady, setProfileGateReady] = useState(false);
  const [profileComplete, setProfileComplete] = useState(true);

  useEffect(() => {
    let isActive = true;

    if (shouldBypassProfileGate || isProfileRoute) {
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
  }, [isProfileRoute, shouldBypassProfileGate]);

  useEffect(() => {
    if (!profileGateReady || shouldBypassProfileGate || isProfileRoute || profileComplete) {
      return;
    }

    router.replace('/profile');
  }, [isProfileRoute, profileComplete, profileGateReady, router, shouldBypassProfileGate]);

  const isTabsGateLoading = !profileGateReady && !shouldBypassProfileGate && !isProfileRoute;

  return (
    <>
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
      {isTabsGateLoading ? (
        <View
          pointerEvents="auto"
          style={[StyleSheet.absoluteFill, { zIndex: 9999, elevation: 9999 }]}
        >
          <AppLoadingShell />
        </View>
      ) : null}
    </>
  );
}
