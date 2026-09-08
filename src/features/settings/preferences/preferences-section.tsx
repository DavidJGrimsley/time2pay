import { Pressable, Text, View } from 'react-native';
import { useAppearanceUiStore, type AppearancePreference } from '@/stores/appearance-store';

const APPEARANCE_OPTIONS: { value: AppearancePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

/**
 * Appearance override for the app. Uses the app's existing Uniwind theming engine
 * (`Uniwind.setTheme`) so it applies instantly across the whole app, not just this screen,
 * and persists the choice in local storage so it survives reloads.
 */
export function PreferencesSection() {
  const appearancePreference = useAppearanceUiStore((state) => state.appearancePreference);
  const setAppearancePreference = useAppearanceUiStore((state) => state.setAppearancePreference);

  return (
    <View className="gap-3">
      <Text className="text-sm text-muted">
        Choose how Time2Pay looks on this device. &ldquo;System&rdquo; follows your device&apos;s
        light/dark setting.
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {APPEARANCE_OPTIONS.map((option) => {
          const active = appearancePreference === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => setAppearancePreference(option.value)}
              className={active ? 'rounded-full bg-secondary px-4 py-2' : 'rounded-full border border-border px-4 py-2'}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text className={active ? 'font-semibold text-white' : 'font-semibold text-heading'}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
