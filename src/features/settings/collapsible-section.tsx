import { useEffect, useState, type PropsWithChildren } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Octicons } from '@expo/vector-icons';
import { useUniwind } from 'uniwind';

const HEADING_COLOR_BY_THEME = {
  light: '#1a1f16',
  dark: '#f8f7f3',
} as const;

type CollapsibleSectionProps = PropsWithChildren<{
  title: string;
  description?: string;
  defaultExpanded?: boolean;
}>;

/**
 * Shared accordion-style card used to group settings sections on the hub page
 * (Profile & Business, Data & Backup, Preferences, Referrals) so the page reads
 * as a scannable list instead of one long scroll.
 */
export function CollapsibleSection({
  title,
  description,
  defaultExpanded = false,
  children,
}: CollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const { theme } = useUniwind();
  const headingColor = HEADING_COLOR_BY_THEME[theme === 'dark' ? 'dark' : 'light'];

  // defaultExpanded can flip true after mount (e.g. an async profile-completion
  // check resolves) — force the section open when that happens so whatever
  // needs attention isn't hidden behind a closed accordion. Never auto-collapse
  // it back, so a user who manually closed it isn't surprised.
  useEffect(() => {
    if (defaultExpanded) {
      setExpanded(true);
    }
  }, [defaultExpanded]);

  return (
    <View className="gap-3 rounded-xl bg-card p-4">
      <Pressable
        className="flex-row items-center justify-between gap-3"
        onPress={() => setExpanded((current) => !current)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <View className="flex-1 gap-1">
          <Text className="text-xl font-bold text-heading">{title}</Text>
          {description ? <Text className="text-sm text-muted">{description}</Text> : null}
        </View>
        <Octicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={headingColor} />
      </Pressable>
      {expanded ? <View className="gap-3">{children}</View> : null}
    </View>
  );
}
