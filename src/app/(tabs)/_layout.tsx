import { Tabs, usePathname, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';
import { AppLoadingShell } from '@/components/app-loading-shell';
import { RouteNav } from '@/components/route-nav';
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

  const backgroundColor = isDark ? '#1a1f16' : '#f8f7f3';

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={styles.navContainer}>
        <RouteNav />
      </View>
      <View style={styles.tabsContainer}>
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
          <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
        </Tabs>
      </View>
      {isTabsGateLoading ? (
        <View
          style={[StyleSheet.absoluteFill, { pointerEvents: 'auto', zIndex: 9999, elevation: 9999 }]}
        >
          <AppLoadingShell />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  navContainer: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 8,
  },
  tabsContainer: {
    flex: 1,
  },
});
