import { View } from 'react-native';
import { AppLoadingShell } from '@/components/app-loading-shell';
import { AppNativeTabs } from '@/components/app-native-tabs';
import { useTabsRouteGate } from '@/hooks/use-tabs-route-gate';

export default function TabsLayoutNative() {
  const { backgroundColor, isTabsGateLoading, shouldHoldTabsForRootGate } = useTabsRouteGate();

  if (shouldHoldTabsForRootGate) {
    return (
      <View className="flex-1" style={{ backgroundColor }}>
        <AppLoadingShell />
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor }}>
      <AppNativeTabs />
      {isTabsGateLoading ? (
        <View className="absolute inset-0" pointerEvents="auto" style={{ zIndex: 9999, elevation: 9999 }}>
          <AppLoadingShell />
        </View>
      ) : null}
    </View>
  );
}
