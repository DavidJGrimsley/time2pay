import { Text, View } from 'react-native';

export function Timer() {
  return (
    <View className="gap-2 rounded-xl bg-card p-4">
      <Text className="text-xl font-bold text-heading">Timer</Text>
      <Text className="text-muted">Session timing controls will appear here.</Text>
    </View>
  );
}
