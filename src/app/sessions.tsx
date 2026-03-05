import { ScrollView, View } from 'react-native';
import { RouteNav } from '../components/route-nav';
import { SessionsOverview } from '../components/sessions-overview';

export default function SessionsRoute() {
  return (
    <ScrollView className="flex-1 bg-background" contentInsetAdjustmentBehavior="automatic">
      <View className="gap-4 p-6">
        <RouteNav />
        <SessionsOverview />
      </View>
    </ScrollView>
  );
}
