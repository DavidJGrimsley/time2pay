import { Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { CosmosLoadingAnimation } from '@/components/UI/Loading';

export function AppLoadingShell() {
  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <Animated.View
        className="w-full max-w-md items-center gap-3 rounded-[28px] border border-border bg-card px-6 py-8"
        entering={FadeIn.duration(160)}
        exiting={FadeOut.duration(120)}
      >
        <Text className="text-sm font-bold uppercase tracking-[2px] text-muted">Time2Pay</Text>
        <CosmosLoadingAnimation size={132} />
        <Text className="text-center text-3xl font-bold text-heading">Loading your workspace...</Text>
        <Text className="text-center text-base leading-7 text-foreground">
          Restoring your session and getting your workspace ready.
        </Text>
      </Animated.View>
    </View>
  );
}
