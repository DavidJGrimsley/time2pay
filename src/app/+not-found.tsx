import { Link, Stack } from 'expo-router';
import { Text, View } from 'react-native';

export default function NotFoundRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not Found' }} />
      <View className="flex-1 items-center justify-center gap-3 p-6">
        <Text className="text-lg font-bold text-heading">Page not found.</Text>
        <Link href="/" className="font-semibold text-link">
          Return to dashboard
        </Link>
      </View>
    </>
  );
}
