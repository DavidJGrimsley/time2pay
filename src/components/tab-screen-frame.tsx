import React from 'react';
import type { PropsWithChildren } from 'react';
import { ScrollView } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

export function TabScreenFrame({ children }: PropsWithChildren) {
  return (
    <ScrollView className="flex-1 bg-background" contentInsetAdjustmentBehavior="automatic">
      <Animated.View className="p-6" entering={FadeIn.duration(160)}>
        {children}
      </Animated.View>
    </ScrollView>
  );
}
