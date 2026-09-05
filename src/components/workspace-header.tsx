import { View } from 'react-native';
import { SettingsGearButton } from '@/components/settings-gear-button';
import { WorkspaceNavBanner } from '@/components/workspace-nav-banner';
import { WorkspacePrimaryTabs } from '@/components/workspace-primary-tabs';

export function WorkspaceHeader() {
  return (
    <View className="gap-2">
      <WorkspaceNavBanner />
      <View className="flex-row flex-wrap items-center gap-2">
        <WorkspacePrimaryTabs />
        <SettingsGearButton />
      </View>
    </View>
  );
}
