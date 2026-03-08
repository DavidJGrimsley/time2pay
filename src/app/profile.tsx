import { ScrollView, View } from 'react-native';
import { ProfileOverview } from '../components/profile-overview';
import { RouteNav } from '../components/route-nav';

export default function ProfileRoute() {
  return (
    <ScrollView className="flex-1 bg-background" contentInsetAdjustmentBehavior="automatic">
      <View className="gap-4 p-6">
        <RouteNav />
        <ProfileOverview />
      </View>
    </ScrollView>
  );
}
