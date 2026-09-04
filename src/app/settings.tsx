import { View } from 'react-native';
import { RouteNav } from '@/components/route-nav';
import { TabScreenFrame } from '@/components/tab-screen-frame';
import { SettingsScreen } from '@/features/settings/settings-screen';

export default function SettingsRoute() {
  return (
    <View className="flex-1 bg-background">
      <View className="px-6 pt-6 pb-2">
        <RouteNav />
      </View>
      <TabScreenFrame>
        <SettingsScreen />
      </TabScreenFrame>
    </View>
  );
}
