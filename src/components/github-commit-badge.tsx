import * as Linking from 'expo-linking';
import { Platform, Pressable, Text, View } from 'react-native';
import { formatCommitBadgeLabel } from '@/services/github';

type GitHubCommitBadgeProps = {
  commitSha: string | null | undefined;
  commitUrl?: string | null;
  textClassName?: string;
  containerClassName?: string;
};

export function GitHubCommitBadge({
  commitSha,
  commitUrl,
  textClassName = 'text-xs text-secondary',
  containerClassName = '',
}: GitHubCommitBadgeProps) {
  const openCommitLink = (url: string): void => {
    if (Platform.OS === 'web') {
      // On web, force a new tab for provenance links.
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }

    Linking.openURL(url).catch(() => undefined);
  };

  const label = formatCommitBadgeLabel(commitSha);
  if (!label) {
    return null;
  }

  if (!commitUrl) {
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
          openCommitLink(commitUrl);
        }}
      >
        <Text className={`${textClassName} font-semibold underline`}>{label}</Text>
      </Pressable>
    </View>
  );
}
