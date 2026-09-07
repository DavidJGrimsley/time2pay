import type { PropsWithChildren } from 'react';
import { View } from 'react-native';

/** Keeps settings pages comfortably readable on desktop while retaining full width on smaller screens. */
export function SettingsPageWidth({ children }: PropsWithChildren) {
  return (
    <View className="w-full flex-1 self-center lg:w-4/5 lg:max-w-[1440px]">
      {children}
    </View>
  );
}
