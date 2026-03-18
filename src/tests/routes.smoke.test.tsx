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
    FadeInDown: {
      delay: () => ({
        duration: () => undefined,
      }),
    },
    LinearTransition: {
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

vi.mock('../components/payments-overview', () => ({
  PaymentsOverview: () => null,
}));

vi.mock('../components/invoices-overview', () => ({
  InvoicesOverview: () => null,
}));

describe('web route smoke tests', () => {
  it('renders the Payments route shell', async () => {
    const { default: PaymentsRoute } = await import('../app/payments');
    expect(() => renderer.create(<PaymentsRoute />)).not.toThrow();
  });

  it('renders the Invoices route shell', async () => {
    const { default: InvoicesRoute } = await import('../app/invoices');
    expect(() => renderer.create(<InvoicesRoute />)).not.toThrow();
  });
});
