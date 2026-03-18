import React from 'react';
import { ScrollView } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { PaymentsOverview } from '../components/payments-overview';
import { RouteNav } from '../components/route-nav';

export default function PaymentsRoute() {
  const smoothLayout = LinearTransition.springify().damping(20).stiffness(170);

  return (
    <ScrollView className="flex-1 bg-background" contentInsetAdjustmentBehavior="automatic">
      <Animated.View className="gap-4 p-6" layout={smoothLayout}>
        <Animated.View layout={smoothLayout}>
          <RouteNav />
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(40).duration(220)} layout={smoothLayout}>
          <PaymentsOverview />
        </Animated.View>
      </Animated.View>
    </ScrollView>
  );
}
