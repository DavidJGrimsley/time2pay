import { type Href, Link, usePathname } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { isHostedMode } from '@/services/runtime-mode';
import { useAuthUiStore } from '@/stores/auth-ui-store';

type RouteLink = {
  href: string;
  label: string;
};

const routeLinks: RouteLink[] = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/sessions', label: 'Sessions' },
  { href: '/projects', label: 'Projects' },
  { href: '/invoices', label: 'Invoices' },
  { href: '/bank', label: 'Bank' },
  { href: '/payments', label: 'Payments' },
  { href: '/profile', label: 'Profile' },
];

export function RouteNav() {
  const pathname = usePathname();
  const hostedMode = isHostedMode();
  const isAuthenticated = useAuthUiStore((state) => state.isAuthenticated);
  const tourModeEnabled = useAuthUiStore((state) => state.tourModeEnabled);
  const showSignInBanner = hostedMode && !isAuthenticated;

  return (
    <View className="gap-2">
      {showSignInBanner ? (
        <View className="flex-row flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2">
          <Text className="text-xs text-muted">
            {tourModeEnabled
              ? 'Tour mode active. Sign in to save data to your hosted account.'
              : 'Sign in to unlock hosted account sync.'}
          </Text>
          <Link href="/sign-in" asChild>
            <Pressable className="rounded-full bg-secondary px-3 py-1.5">
              <Text className="text-xs font-semibold text-white">Sign In</Text>
            </Pressable>
          </Link>
        </View>
      ) : null}

      <View className="flex-row flex-wrap gap-2">
        {routeLinks.map((routeLink) => {
          const href = routeLink.href;
          const active = href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href);
          const navButtonClassName = active
            ? 'rounded-full bg-secondary px-3.5 py-2'
            : 'rounded-full bg-primary px-3.5 py-2';
          const navLabelClassName = active ? 'font-semibold text-white' : 'font-semibold text-heading';

          return (
            <Link key={href} href={routeLink.href as Href} asChild>
              <Pressable className={navButtonClassName}>
                <Text className={navLabelClassName}>{routeLink.label}</Text>
              </Pressable>
            </Link>
          );
        })}
      </View>
    </View>
  );
}
