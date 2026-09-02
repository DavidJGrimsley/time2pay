import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { usePathname, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useColorScheme, View } from 'react-native';
import { AppLoadingShell } from '@/components/app-loading-shell';
import { useResolvedDataMode } from '@/hooks/use-resolved-data-mode';
import { getProfileCompletion } from '@/services/profile-completion';
import { resolveHostedRouteGate } from '@/features/onboarding/onboarding-route-gate';
import { useAuthUiStore } from '@/stores/auth-ui-store';

export default function TabsLayoutNative() {
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
      <NativeTabs>
        <NativeTabs.Trigger name="dashboard">
          <NativeTabs.Trigger.Icon sf="house.fill" md="home" />
          <NativeTabs.Trigger.Label>Dashboard</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="sessions">
          <NativeTabs.Trigger.Icon sf="clock.fill" md="schedule" />
          <NativeTabs.Trigger.Label>Sessions</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="projects">
          <NativeTabs.Trigger.Icon sf="folder.fill" md="folder" />
          <NativeTabs.Trigger.Label>Projects</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="invoices">
          <NativeTabs.Trigger.Icon sf="doc.text.fill" md="description" />
          <NativeTabs.Trigger.Label>Invoices</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="bank">
          <NativeTabs.Trigger.Icon sf="building.columns.fill" md="account_balance" />
          <NativeTabs.Trigger.Label>Bank</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="payments">
          <NativeTabs.Trigger.Icon sf="creditcard.fill" md="credit_card" />
          <NativeTabs.Trigger.Label>Payments</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      </NativeTabs>
      {isTabsGateLoading ? (
        <View className="absolute inset-0" pointerEvents="auto" style={{ zIndex: 9999, elevation: 9999 }}>
          <AppLoadingShell />
        </View>
      ) : null}
    </View>
  );
}
