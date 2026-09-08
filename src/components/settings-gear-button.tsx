import { Octicons } from '@expo/vector-icons';
import { type Href, Link, usePathname } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useUniwind } from 'uniwind';
import { canvasForeground } from '@/components/workspace-nav';

export function SettingsGearButton() {
  const pathname = usePathname();
  const { theme } = useUniwind();
  const isDark = theme === 'dark';
  const active = pathname === '/settings' || pathname.startsWith('/settings/');

  return (
    <Link href={'/settings' as Href} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Settings"
        accessibilityHint="Open account settings."
        className={
          active
            ? 'rounded-full bg-secondary p-2'
            : 'rounded-full border border-border bg-card p-2'
        }
      >
        <View pointerEvents="none">
          <Octicons name="gear" size={18} color={active ? '#ffffff' : canvasForeground(isDark)} />
        </View>
      </Pressable>
    </Link>
  );
}
