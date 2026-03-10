import { Text, View } from 'react-native';

export function AppLoadingShell() {
  return (
    <View className="flex-1 items-center justify-center bg-background px-6">
      <View className="w-full max-w-md items-center gap-3 rounded-[28px] border border-border bg-card px-6 py-8">
        <Text className="text-sm font-bold uppercase tracking-[2px] text-muted">Time2Pay</Text>
        <Text className="text-center text-3xl font-bold text-heading">Loading your workspace...</Text>
        <Text className="text-center text-base leading-7 text-foreground">
          Checking whether you already finished your business profile.
        </Text>
      </View>
    </View>
  );
}
