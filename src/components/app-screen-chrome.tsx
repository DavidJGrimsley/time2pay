import type { PropsWithChildren } from 'react';
import { Platform, View } from 'react-native';
import { WorkspaceHeader } from '@/components/workspace-header';

export function AppScreenChrome({ children }: PropsWithChildren) {
  if (Platform.OS !== 'web') {
    return <View className="flex-1 bg-background">{children}</View>;
  }

  return (
    <View className="flex-1 bg-background">
      <View className="px-6 pt-6 pb-2">
        <WorkspaceHeader />
      </View>
      <View className="flex-1">{children}</View>
    </View>
  );
}
