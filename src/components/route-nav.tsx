import { type Href, Link, usePathname } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

type RouteLink = {
  href: Href;
  label: string;
};

const routeLinks: RouteLink[] = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/sessions', label: 'Sessions' },
  { href: '/invoices', label: 'Invoices' },
  { href: '/bank', label: 'Bank' },
  { href: '/profile', label: 'Profile' },
];

export function RouteNav() {
  const pathname = usePathname();

  return (
    <View className="flex-row flex-wrap gap-2">
      {routeLinks.map((routeLink) => {
        const href = routeLink.href as string;
        const active = href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href);
        const navButtonClassName = active
          ? 'rounded-full bg-secondary px-3.5 py-2'
          : 'rounded-full bg-primary px-3.5 py-2';
        const navLabelClassName = active ? 'font-semibold text-white' : 'font-semibold text-heading';

        return (
          <Link key={href} href={routeLink.href} asChild>
            <Pressable className={navButtonClassName}>
              <Text className={navLabelClassName}>{routeLink.label}</Text>
            </Pressable>
          </Link>
        );
      })}
    </View>
  );
}
