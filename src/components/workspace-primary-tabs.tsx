import { type Href, Link, usePathname } from 'expo-router';
import { TabTrigger } from 'expo-router/ui';
import { View } from 'react-native';
import { PRIMARY_TAB_ROUTES } from '@/components/workspace-nav';
import { resolvePrimaryTabIndex } from '@/components/workspace-tab-highlight';
import { WorkspaceTabPill } from '@/components/workspace-tab-pill';
import { useTravelingTabProgress } from '@/hooks/use-traveling-tab-progress';

export function WorkspacePrimaryTabs({ asTriggers = false }: { asTriggers?: boolean }) {
  const pathname = usePathname();
  const activeIndex = resolvePrimaryTabIndex(pathname);
  const { enabled, progress } = useTravelingTabProgress(activeIndex);

  return (
    <View className="flex-1 flex-row flex-wrap gap-2">
      {PRIMARY_TAB_ROUTES.map((route, index) => {
        if (asTriggers) {
          return (
            <TabTrigger key={route.name} name={route.name} asChild>
              <WorkspaceTabPill
                enabled={enabled}
                icon={route.icon}
                index={index}
                label={route.label}
                progress={progress}
                selected={activeIndex === index}
              />
            </TabTrigger>
          );
        }

        return (
          <Link key={route.href} href={route.href as Href} asChild>
            <WorkspaceTabPill
              enabled={enabled}
              icon={route.icon}
              index={index}
              label={route.label}
              progress={progress}
              selected={activeIndex === index}
            />
          </Link>
        );
      })}
    </View>
  );
}
