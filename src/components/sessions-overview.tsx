import { Text, View } from 'react-native';
import { SessionList } from './SessionList';

export function SessionsOverview() {
  return (
    <View className="gap-3">
      <Text className="text-3xl font-extrabold text-heading">Sessions</Text>
      <Text className="text-muted">Track and review your logged work sessions.</Text>
      <SessionList />
    </View>
  );
}
