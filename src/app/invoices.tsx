import { ScrollView, View } from 'react-native';
import { RouteNav } from '../components/route-nav';
import { InvoicesOverview } from '../components/invoices-overview';

export default function InvoicesRoute() {
  return (
    <ScrollView className="flex-1 bg-background" contentInsetAdjustmentBehavior="automatic">
      <View className="gap-4 p-6">
        <RouteNav />
        <InvoicesOverview />
      </View>
    </ScrollView>
  );
}
