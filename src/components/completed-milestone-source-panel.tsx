import { Pressable, Text, useColorScheme, View } from 'react-native';
import type { InvoiceMilestoneSource } from '@/hooks/use-invoice-milestone-sources';

export function CompletedMilestoneSourcePanel({
  sources,
  selectedIds,
  onToggle,
}: {
  sources: InvoiceMilestoneSource[];
  selectedIds: string[];
  onToggle: (milestoneId: string) => void;
}) {
  const isDark = useColorScheme() === 'dark';
  // Mercury wraps this source panel in a deliberately light review surface. Keep its
  // heading readable even when the surrounding Time2Pay theme is dark.
  const lightSurfaceTextStyle = isDark ? { color: '#1A1F16' } : undefined;
  const lightSurfaceMutedStyle = isDark ? { color: '#5F675D' } : undefined;

  if (sources.length === 0) return null;
  return (
    <View className="gap-2 border-t border-border pt-3">
      <View className="gap-1">
        <Text className="text-sm font-semibold text-heading" style={lightSurfaceTextStyle}>
          Completed milestones
        </Text>
        <Text className="text-xs text-muted" style={lightSurfaceMutedStyle}>
          Selected by default. Toggle any milestone off before creating the draft.
        </Text>
      </View>
      {sources.map((source) => {
        const selected = selectedIds.includes(source.milestone.id);
        return (
          <Pressable
            key={source.milestone.id}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            onPress={() => onToggle(source.milestone.id)}
            className="flex-row items-center gap-3 rounded-md border border-border bg-background px-3 py-2"
          >
            <View className={selected ? 'h-5 w-5 items-center justify-center rounded border border-secondary bg-secondary' : 'h-5 w-5 rounded border border-border'}>
              {selected ? <Text className="text-xs font-bold text-white">✓</Text> : null}
            </View>
            <View className="min-w-0 flex-1 gap-0.5">
              <Text className="font-semibold text-heading">{source.milestone.title}</Text>
              <Text className="text-xs text-muted">{source.projectName}</Text>
            </View>
            <Text className="font-semibold text-heading">${source.amount.toFixed(2)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
