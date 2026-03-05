import { ScrollView, View } from 'react-native';
import { DashboardOverview } from '../components/dashboard-overview';
import { RouteNav } from '../components/route-nav';

export default function DashboardRoute() {
  return (
    <ScrollView className="flex-1 bg-background" contentInsetAdjustmentBehavior="automatic">
      <View className="gap-4 p-6">
        <RouteNav />
        <DashboardOverview />
      </View>
    </ScrollView>
  );
}
