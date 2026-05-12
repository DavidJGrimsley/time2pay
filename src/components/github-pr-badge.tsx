import * as Linking from 'expo-linking';
import { Platform, Pressable, Text, View } from 'react-native';
import { formatPrBadgeLabel, type GitHubPullRequestState } from '@/services/github';

type GitHubPrBadgeProps = {
  prNumber: number | null | undefined;
  prUrl?: string | null;
  state?: GitHubPullRequestState | null;
  merged?: boolean | null;
  textClassName?: string;
  containerClassName?: string;
};

export function GitHubPrBadge({
  prNumber,
  prUrl,
  state,
  merged,
  textClassName = 'text-xs text-secondary',
  containerClassName = '',
}: GitHubPrBadgeProps) {
  const openPrLink = (url: string): void => {
    if (Platform.OS === 'web') {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    Linking.openURL(url).catch(() => undefined);
  };

  const label = formatPrBadgeLabel({ number: prNumber ?? null, state, merged });
  if (!label) {
    return null;
  }

  if (!prUrl) {
    return (
      <View className={containerClassName}>
        <Text className={`${textClassName} font-semibold`}>{label}</Text>
      </View>
    );
  }

  return (
    <View className={containerClassName}>
      <Pressable
        onPress={() => {
          openPrLink(prUrl);
        }}
      >
        <Text className={`${textClassName} font-semibold underline`}>{label}</Text>
      </Pressable>
    </View>
  );
}
