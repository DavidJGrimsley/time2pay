import { View } from 'react-native';
import { RouteNav } from '@/components/route-nav';
import { TabScreenFrame } from '@/components/tab-screen-frame';
import { CustomersListScreen } from '@/features/settings/customers/customers-list-screen';

export default function CustomersSettingsRoute() {
  return <View className="flex-1 bg-background"><View className="px-6 pb-2 pt-6"><RouteNav /></View><TabScreenFrame><CustomersListScreen /></TabScreenFrame></View>;
}
