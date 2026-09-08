import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  theme: 'light' as 'light' | 'dark',
}));

function makeComponent(name: string) {
  function Component({ children, ...props }: { children?: React.ReactNode }) {
    return React.createElement(name, props, children);
  }

  Component.displayName = name;
  return Component;
}

vi.mock('react-native', () => ({
  View: makeComponent('View'),
}));

vi.mock('expo-router', () => ({
  Tabs: Object.assign(
    ({ children }: { children?: React.ReactNode }) => React.createElement('Tabs', null, children),
    { Screen: makeComponent('TabsScreen') },
  ),
  usePathname: () => '/dashboard',
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock('uniwind', () => ({
  useUniwind: () => ({ theme: mocks.theme }),
}));

vi.mock('@/components/app-loading-shell', () => ({
  AppLoadingShell: () => null,
}));

vi.mock('@/components/route-nav', () => ({
  RouteNav: () => null,
}));

vi.mock('@/hooks/use-resolved-data-mode', () => ({
  useResolvedDataMode: () => ({ hostedMode: false, resolved: true }),
}));

vi.mock('@/services/profile-completion', () => ({
  getProfileCompletion: vi.fn(),
}));

vi.mock('@/features/onboarding/onboarding-route-gate', () => ({
  resolveHostedRouteGate: () => ({ canAccessAppRoutes: true, shouldShowLoadingShell: false }),
}));

vi.mock('@/stores/auth-ui-store', () => ({
  useAuthUiStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      authReady: true,
      isAuthenticated: true,
      onboardingGateReady: true,
      onboardingGateStatus: 'complete',
      hostedAccessGateReady: true,
      hostedAccessGateStatus: 'complete',
      tourModeEnabled: true,
      tourModeHydrated: true,
    }),
}));

function shellBackground(root: renderer.ReactTestRenderer): string | undefined {
  const shell = root.root.findAll(
    (node) => String(node.type) === 'View' && node.props.className === 'flex-1',
  )[0];

  return shell?.props.style?.backgroundColor;
}

describe('TabsLayoutWeb theme surface', () => {
  beforeEach(() => {
    mocks.theme = 'light';
  });

  it('updates the navigation shell background when the app theme changes', async () => {
    const { default: TabsLayoutWeb } = await import('@/app/(tabs)/_layout.web');

    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(<TabsLayoutWeb />);
    });

    expect(shellBackground(root)).toBe('#f8f7f3');

    mocks.theme = 'dark';
    await act(async () => {
      root.update(<TabsLayoutWeb />);
    });

    expect(shellBackground(root)).toBe('#1a1f16');
  });
});
