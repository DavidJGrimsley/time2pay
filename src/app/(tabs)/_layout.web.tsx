import { Tabs, usePathname, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useColorScheme, View } from 'react-native';
import { AppLoadingShell } from '@/components/app-loading-shell';
import { RouteNav } from '@/components/route-nav';
import { useResolvedDataMode } from '@/hooks/use-resolved-data-mode';
import { getProfileCompletion } from '@/services/profile-completion';
import { useAuthUiStore } from '@/stores/auth-ui-store';

export default function TabsLayoutWeb() {
  const pathname = usePathname();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { hostedMode, resolved: dataModeResolved } = useResolvedDataMode();
  const tourModeEnabled = useAuthUiStore((state) => state.tourModeEnabled);
  const shouldBypassProfileGate = dataModeResolved && hostedMode && tourModeEnabled;
  const normalizedPathname = pathname !== '/' ? pathname.replace(/\/+$/, '') : pathname;
  const isSettingsRoute = normalizedPathname === '/settings';
  const [profileGateReady, setProfileGateReady] = useState(false);
  const [profileComplete, setProfileComplete] = useState(true);

  useEffect(() => {
    let isActive = true;

    if (shouldBypassProfileGate || isSettingsRoute) {
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
  }, [isSettingsRoute, shouldBypassProfileGate]);

  useEffect(() => {
    if (!profileGateReady || shouldBypassProfileGate || isSettingsRoute || profileComplete) {
      return;
    }

    router.replace('/settings');
  }, [isSettingsRoute, profileComplete, profileGateReady, router, shouldBypassProfileGate]);

  const isTabsGateLoading = !profileGateReady && !shouldBypassProfileGate && !isSettingsRoute;
  const backgroundColor = isDark ? '#1a1f16' : '#f8f7f3';

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
          <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
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
