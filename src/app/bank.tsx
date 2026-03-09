import { ScrollView } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { BankOverview } from '../components/bank-overview';
import { RouteNav } from '../components/route-nav';

export default function BankRoute() {
  const smoothLayout = LinearTransition.springify().damping(20).stiffness(170);

  return (
    <ScrollView className="flex-1 bg-background" contentInsetAdjustmentBehavior="automatic">
      <Animated.View className="gap-4 p-6" layout={smoothLayout}>
        <Animated.View layout={smoothLayout}>
          <RouteNav />
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(40).duration(220)} layout={smoothLayout}>
          <BankOverview />
        </Animated.View>
      </Animated.View>
    </ScrollView>
  );
}
