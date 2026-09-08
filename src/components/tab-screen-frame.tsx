import React from 'react';
import type { PropsWithChildren } from 'react';
import { Platform, ScrollView } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

export function TabScreenFrame({ children }: PropsWithChildren) {
  const contentClassName = Platform.OS === 'web' ? 'px-6 pb-6 pt-0' : 'p-6';

  return (
    <ScrollView className="flex-1 bg-background" contentInsetAdjustmentBehavior="automatic">
      <Animated.View className={contentClassName} entering={FadeIn.duration(160)}>
        {children}
      </Animated.View>
    </ScrollView>
  );
}
