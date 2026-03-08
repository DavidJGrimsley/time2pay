import { View } from 'react-native';
import { SessionList } from './SessionList';

export function SessionsOverview() {
  return (
    <View className="gap-3">
      <SessionList />
    </View>
  );
}
