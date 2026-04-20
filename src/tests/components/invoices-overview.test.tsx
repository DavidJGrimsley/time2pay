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
    Pressable: makeComponent('Pressable'),
    Text: makeComponent('Text'),
    View: makeComponent('View'),
  };
});

vi.mock('expo-router', async () => {
  const ReactModule = await import('react');
  return {
    Link: ({ children }: { children?: React.ReactNode }) =>
      ReactModule.createElement(ReactModule.Fragment, null, children),
  };
});

vi.mock('@mr.dj2u/mercury-ui', async () => {
  const ReactModule = await import('react');
  return {
    MercurySessionInvoiceWorkspace: () =>
      ReactModule.createElement('Text', null, 'Mercury workspace'),
  };
});

vi.mock('../../components/InvoiceBuilder', async () => {
  const ReactModule = await import('react');
  return {
    InvoiceBuilder: () => ReactModule.createElement('Text', null, 'T2P workspace'),
  };
});

vi.mock('../../components/InvoiceHistory', async () => {
  const ReactModule = await import('react');
  return {
    InvoiceHistory: () => ReactModule.createElement('Text', null, 'Invoice history'),
  };
});

vi.mock('@/hooks/use-stable-window-dimensions', () => ({
  useStableWindowDimensions: () => ({ width: 1280, height: 900 }),
}));

vi.mock('@/hooks/use-resolved-data-mode', () => ({
  useResolvedDataMode: () => ({
    hostedMode: true,
    dataMode: 'hosted',
    resolved: true,
  }),
}));

vi.mock('@/hooks/use-time2pay-mercury-session-workspace', () => ({
  useTime2PayMercurySessionWorkspace: () => ({}),
}));

vi.mock('@/stores/auth-ui-store', () => ({
  useAuthUiStore: (selector: (state: { isAuthenticated: boolean; tourModeEnabled: boolean }) => unknown) =>
    selector({ isAuthenticated: true, tourModeEnabled: false }),
}));

vi.mock('@/services/mercury-credentials', () => ({
  getMercuryCredentialStatus: vi.fn().mockResolvedValue({
    configured: false,
    keyLastFour: null,
    updatedAt: null,
  }),
}));

vi.mock('@/services/mercury-ui-adapters', () => ({
  mercuryUiAdapter: {},
}));

describe('InvoicesOverview', () => {
  it('renders the explicit invoice builder toggle', async () => {
    const { InvoicesOverview } = await import('../../components/invoices-overview');
    const instanceRef: { current: renderer.ReactTestRenderer | null } = { current: null };
    await renderer.act(async () => {
      instanceRef.current = renderer.create(<InvoicesOverview />);
    });
    const tree = instanceRef.current?.toJSON();

    const rendered = JSON.stringify(tree);
    expect(rendered).toContain('T2P Invoice Builder');
    expect(rendered).toContain('Mercury Invoice Builder');
  });
});
