import { Stack } from 'expo-router';
import { Platform } from 'react-native';
import { useUniwind } from 'uniwind';
import { SettingsGearButton } from '@/components/settings-gear-button';
import { canvasBackground, canvasForeground } from '@/components/workspace-nav';

export function TabStackLayout({ title }: { title: string }) {
  const { theme } = useUniwind();
  const isDark = theme === 'dark';
  const backgroundColor = canvasBackground(isDark);
  const tintColor = canvasForeground(isDark);

  return (
    <Stack
      screenOptions={{
        title,
        headerShown: Platform.OS !== 'web',
        headerShadowVisible: false,
        headerStyle: { backgroundColor },
        headerTintColor: tintColor,
        contentStyle: { backgroundColor },
        headerRight: () => <SettingsGearButton />,
      }}
    />
  );
}
