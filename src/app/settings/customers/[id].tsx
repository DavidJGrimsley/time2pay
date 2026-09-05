import { View } from 'react-native';
import { RouteNav } from '@/components/route-nav';
import { TabScreenFrame } from '@/components/tab-screen-frame';
import { CustomerDetailsScreen } from '@/features/settings/customers/customer-details-screen';

export default function CustomerDetailsRoute() {
  return <View className="flex-1 bg-background"><View className="px-6 pb-2 pt-6"><RouteNav /></View><TabScreenFrame><CustomerDetailsScreen /></TabScreenFrame></View>;
}
