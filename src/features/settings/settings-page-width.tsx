import type { PropsWithChildren } from 'react';
import { View } from 'react-native';

/** Keeps the route surface full-width so desktop wheel input works anywhere in a settings page. */
export function SettingsPageWidth({ children }: PropsWithChildren) {
  return <View className="w-full flex-1 self-stretch">{children}</View>;
}
