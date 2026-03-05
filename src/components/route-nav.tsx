import { type Href, Link, usePathname } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

type RouteLink = {
  href: Href;
  label: string;
};

const routeLinks: RouteLink[] = [
  { href: '/', label: 'Dashboard' },
  { href: '/sessions', label: 'Sessions' },
  { href: '/invoices', label: 'Invoices' },
];

export function RouteNav() {
  const pathname = usePathname();

  return (
    <View className="flex-row gap-2">
      {routeLinks.map((routeLink) => {
        const href = routeLink.href as string;
        const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
        const navButtonClassName = active
          ? 'rounded-full bg-gray-900 px-3.5 py-2'
          : 'rounded-full bg-gray-200 px-3.5 py-2';
        const navLabelClassName = active ? 'font-semibold text-gray-50' : 'font-semibold text-gray-800';

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
