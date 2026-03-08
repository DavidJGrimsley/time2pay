import { ScrollView, View } from 'react-native';
import { BankOverview } from '../components/bank-overview';
import { RouteNav } from '../components/route-nav';

export default function BankRoute() {
  return (
    <ScrollView className="flex-1 bg-background" contentInsetAdjustmentBehavior="automatic">
      <View className="gap-4 p-6">
        <RouteNav />
        <BankOverview />
      </View>
    </ScrollView>
  );
}
