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
    },
    FadeIn: {
      delay: () => ({
        duration: () => undefined,
      }),
      duration: () => undefined,
    },
    FadeOut: {
      duration: () => undefined,
    },
    LinearTransition: {
      duration: () => ({}),
      springify: () => ({
        damping: () => ({
          stiffness: () => ({}),
        }),
      }),
    },
  };
});

vi.mock('../components/route-nav', () => ({
  RouteNav: () => null,
}));

vi.mock('@/components/route-nav', () => ({
  RouteNav: () => null,
}));

vi.mock('../features/settings/settings-screen', () => ({
  SettingsScreen: () => null,
}));

vi.mock('@/features/settings/settings-screen', () => ({
  SettingsScreen: () => null,
}));

vi.mock('../features/settings/integrations/integrations-screen', () => ({
  IntegrationsScreen: () => null,
}));

vi.mock('@/features/settings/integrations/integrations-screen', () => ({
  IntegrationsScreen: () => null,
}));

vi.mock('../components/payments-overview', () => ({
  PaymentsOverview: () => null,
}));

vi.mock('../components/invoices-overview', () => ({
  InvoicesOverview: () => null,
}));

vi.mock('../components/projects-overview', () => ({
  ProjectsOverview: () => null,
}));

describe('web route smoke tests', () => {
  it('renders the Payments route shell', async () => {
    const { default: PaymentsRoute } = await import('../app/(tabs)/payments');
    expect(() => renderer.create(<PaymentsRoute />)).not.toThrow();
  });

  it('renders the Invoices route shell', async () => {
    const { default: InvoicesRoute } = await import('../app/(tabs)/invoices');
    expect(() => renderer.create(<InvoicesRoute />)).not.toThrow();
  });

  it('renders the Projects route shell', async () => {
    const { default: ProjectsRoute } = await import('../app/(tabs)/projects');
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
});
