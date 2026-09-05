import React from 'react';
import renderer from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', async () => {
  const ReactModule = await import('react');

  function makeComponent(name: string) {
    return ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactModule.createElement(name, props, children);
  }

  return {
    ScrollView: makeComponent('ScrollView'),
    View: makeComponent('View'),
    Text: makeComponent('Text'),
    Pressable: makeComponent('Pressable'),
    Platform: { OS: 'web' },
    useColorScheme: () => 'light',
  };
});

vi.mock('react-native-reanimated', async () => {
  const ReactModule = await import('react');

  return {
    __esModule: true,
    default: {
      View: ({ children }: { children?: React.ReactNode }) =>
        ReactModule.createElement('AnimatedView', null, children),
      Text: ({ children }: { children?: React.ReactNode }) =>
        ReactModule.createElement('AnimatedText', null, children),
    },
    Easing: { bezier: () => undefined },
    FadeIn: {
      delay: () => ({
        duration: () => undefined,
      }),
      duration: () => undefined,
    },
    FadeOut: {
      duration: () => undefined,
    },
    interpolateColor: () => '#ffffff',
    LinearTransition: {
      duration: () => ({}),
      springify: () => ({
        damping: () => ({
          stiffness: () => ({}),
        }),
      }),
    },
    useReducedMotion: () => false,
    useSharedValue: (value: number) => ({ get: () => value, set: () => undefined }),
    useAnimatedStyle: (fn: () => unknown) => fn(),
    withTiming: (value: number) => value,
  };
});

vi.mock('expo-router', () => ({
  Redirect: (props: { href: unknown }) => React.createElement('Redirect', props),
  Link: ({ children }: { children?: React.ReactNode }) => React.createElement(React.Fragment, null, children),
  usePathname: () => '/settings',
}));

vi.mock('expo-router/ui', () => ({
  TabTrigger: ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

vi.mock('uniwind', () => ({
  useUniwind: () => ({ theme: 'light', hasAdaptiveThemes: true }),
}));

vi.mock('@expo/vector-icons', () => ({
  Octicons: () => null,
}));

vi.mock('@/components/workspace-nav-banner', () => ({
  WorkspaceNavBanner: () => null,
}));

vi.mock('@/features/settings/settings-screen', () => ({
  SettingsScreen: () => null,
}));

vi.mock('@/features/settings/integrations/integrations-screen', () => ({
  IntegrationsScreen: () => null,
}));

vi.mock('@/components/invoices-overview', () => ({
  InvoicesOverview: () => null,
}));

vi.mock('@/components/projects-overview', () => ({
  ProjectsOverview: () => null,
}));

vi.mock('@/components/mercury-overview', () => ({
  MercuryOverview: () => null,
}));

describe('web route smoke tests', () => {
  it('renders the Mercury route shell', async () => {
    const { default: MercuryRoute } = await import('../app/(tabs)/mercury/index');
    expect(() => renderer.create(<MercuryRoute />)).not.toThrow();
  });

  it('renders the Invoices route shell', async () => {
    const { default: InvoicesRoute } = await import('../app/(tabs)/invoices/index');
    expect(() => renderer.create(<InvoicesRoute />)).not.toThrow();
  });

  it('renders the Projects route shell', async () => {
    const { default: ProjectsRoute } = await import('../app/projects');
    expect(() => renderer.create(<ProjectsRoute />)).not.toThrow();
  });

  it('renders the root Settings route shell', async () => {
    const { default: SettingsRoute } = await import('../app/settings');
    expect(() => renderer.create(<SettingsRoute />)).not.toThrow();
  });

  it('renders the Settings Integrations route shell', async () => {
    const { default: IntegrationsRoute } = await import('../app/settings/integrations');
    expect(() => renderer.create(<IntegrationsRoute />)).not.toThrow();
  });

  it('redirects /bank to Mercury', async () => {
    const { BANK_REDIRECT_HREF } = await import('../app/bank');
    expect(BANK_REDIRECT_HREF).toBe('/mercury');
  });

  it('redirects /payments to Mercury payments section', async () => {
    const { PAYMENTS_REDIRECT_HREF } = await import('../app/payments');
    expect(PAYMENTS_REDIRECT_HREF).toEqual({
      pathname: '/mercury',
      params: { section: 'payments' },
    });
  });
});
