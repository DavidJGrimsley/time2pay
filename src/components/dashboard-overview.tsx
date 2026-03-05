import { Text, View } from 'react-native';
import { Timer } from './Timer';

export function DashboardOverview() {
  return (
    <View className="gap-3">
      <Text className="text-3xl font-extrabold text-heading">Dashboard</Text>
      <Text className="text-muted">Quick snapshot of your work and billing flow.</Text>
      <Timer />
    </View>
  );
}
