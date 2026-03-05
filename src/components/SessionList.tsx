import { Text, View } from 'react-native';

export function SessionList() {
  return (
    <View className="gap-2 rounded-xl bg-card p-4">
      <Text className="text-xl font-bold text-heading">Session List</Text>
      <Text className="text-muted">Logged work sessions will be listed here.</Text>
    </View>
  );
}
