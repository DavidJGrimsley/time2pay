import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { Uniwind } from 'uniwind';
import '../../global.css';

// Web: apply system theme ASAP (before first paint) to avoid light→dark flash.
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  try {
    Uniwind.setTheme('system');
  } catch {
    // no-op
  }
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Native: sync Uniwind with OS appearance.
  useEffect(() => {
    Uniwind.setTheme('system');
  }, []);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: isDark ? '#1a1f16' : '#f8f7f3' },
        headerTintColor: isDark ? '#f8f7f3' : '#1a1f16',
        contentStyle: { backgroundColor: isDark ? '#1a1f16' : '#f8f7f3' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Dashboard' }} />
      <Stack.Screen name="sessions" options={{ title: 'Sessions' }} />
      <Stack.Screen name="invoices" options={{ title: 'Invoices' }} />
      <Stack.Screen name="bank" options={{ title: 'Bank' }} />
      <Stack.Screen name="profile" options={{ title: 'Profile' }} />
      <Stack.Screen name="+not-found" options={{ title: 'Not Found' }} />
    </Stack>
  );
}
