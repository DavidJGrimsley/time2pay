import { useColorScheme, View } from 'react-native';
import { ProfileOverview } from '@/components/profile-overview';
import { RouteNav } from '@/components/route-nav';
import { TabScreenFrame } from '@/components/tab-screen-frame';

export default function SettingsRoute() {
  const colorScheme = useColorScheme();
  const backgroundColor = colorScheme === 'dark' ? '#1a1f16' : '#f8f7f3';

  return (
    <View className="flex-1" style={{ backgroundColor }}>
      <View className="px-6 pt-6 pb-2">
        <RouteNav />
      </View>
      <TabScreenFrame>
        <ProfileOverview />
      </TabScreenFrame>
    </View>
  );
}
