import { Tabs, usePathname, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useColorScheme, View } from 'react-native';
import { AppLoadingShell } from '@/components/app-loading-shell';
import { RouteNav } from '@/components/route-nav';
import { useResolvedDataMode } from '@/hooks/use-resolved-data-mode';
import { getProfileCompletion } from '@/services/profile-completion';
import { resolveHostedRouteGate } from '@/features/onboarding/onboarding-route-gate';
import { useAuthUiStore } from '@/stores/auth-ui-store';

export default function TabsLayout() {
  const pathname = usePathname();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
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

  const isTabsGateLoading = !profileGateReady && !shouldBypassProfileGate;

  const backgroundColor = isDark ? '#1a1f16' : '#f8f7f3';

  if (shouldHoldTabsForRootGate) {
    return (
      <View className="flex-1" style={{ backgroundColor }}>
        <AppLoadingShell />
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor }}>
      <View className="px-6 pt-6 pb-2">
        <RouteNav />
      </View>
      <View className="flex-1">
        <Tabs
          backBehavior="history"
          detachInactiveScreens={false}
          screenOptions={{
            headerShown: false,
            lazy: true,
            freezeOnBlur: false,
            animation: 'fade',
            transitionSpec: {
              animation: 'timing',
              config: { duration: 160 },
            },
            sceneStyle: { backgroundColor },
            tabBarStyle: { display: 'none' },
          }}
        >
          <Tabs.Screen name="dashboard" options={{ title: 'Dashboard' }} />
          <Tabs.Screen name="sessions" options={{ title: 'Sessions' }} />
          <Tabs.Screen name="projects" options={{ title: 'Projects' }} />
          <Tabs.Screen name="invoices" options={{ title: 'Invoices' }} />
          <Tabs.Screen name="bank" options={{ title: 'Bank' }} />
          <Tabs.Screen name="payments" options={{ title: 'Payments' }} />
        </Tabs>
      </View>
      {isTabsGateLoading ? (
        <View className="absolute inset-0" pointerEvents="auto" style={{ zIndex: 9999, elevation: 9999 }}>
          <AppLoadingShell />
        </View>
      ) : null}
    </View>
  );
}
