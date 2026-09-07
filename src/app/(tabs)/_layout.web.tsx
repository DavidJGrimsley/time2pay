import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';
import { View } from 'react-native';
import { AppLoadingShell } from '@/components/app-loading-shell';
import { SettingsGearButton } from '@/components/settings-gear-button';
import { PRIMARY_TAB_ROUTES } from '@/components/workspace-nav';
import { WorkspaceNavBanner } from '@/components/workspace-nav-banner';
import { WorkspacePrimaryTabs } from '@/components/workspace-primary-tabs';
import { useTabsRouteGate } from '@/hooks/use-tabs-route-gate';

export default function TabsLayoutWeb() {
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
      <Tabs className="flex-1">
        <View className="gap-2 px-6 pb-2 pt-6">
          <WorkspaceNavBanner />
          <View className="flex-row flex-wrap items-center gap-2">
            <WorkspacePrimaryTabs asTriggers />
            <SettingsGearButton />
          </View>
        </View>
        <TabSlot style={{ flex: 1 }} />
        <TabList style={{ display: 'none' }}>
          {PRIMARY_TAB_ROUTES.map((route) => (
            <TabTrigger key={route.name} name={route.name} href={route.href} />
          ))}
        </TabList>
      </Tabs>
      {isTabsGateLoading ? (
        <View className="absolute inset-0" pointerEvents="auto" style={{ zIndex: 9999, elevation: 9999 }}>
          <AppLoadingShell />
        </View>
      ) : null}
    </View>
  );
}
