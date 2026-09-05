import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  pathname: '/dashboard',
  hostedMode: true,
  dataModeResolved: true,
  isAuthenticated: false,
  tourModeEnabled: false,
  tourInitError: null as string | null,
  setTourInitError: vi.fn(),
  resetTourDemoData: vi.fn(),
}));

function makeComponent(name: string) {
  function Component({ children, ...props }: { children?: React.ReactNode }) {
    return React.createElement(name, props, children);
  }
  Component.displayName = name;
  return Component;
}

vi.mock('react-native', () => ({
  Pressable: makeComponent('Pressable'),
  Text: makeComponent('Text'),
  View: makeComponent('View'),
}));

vi.mock('@expo/vector-icons', () => ({
  Octicons: makeComponent('Octicons'),
}));

vi.mock('expo-router', () => ({
  Link: ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  usePathname: () => mocks.pathname,
}));

vi.mock('uniwind', () => ({
  useUniwind: () => ({ theme: 'light', hasAdaptiveThemes: true }),
}));

vi.mock('react-native-reanimated', async () => {
  const ReactModule = await import('react');

  function passthroughStyle(style: unknown) {
    return style;
  }

  return {
    __esModule: true,
    default: {
      View: ({ children, ...props }: { children?: React.ReactNode }) =>
        ReactModule.createElement('AnimatedView', props, children),
      Text: ({ children, ...props }: { children?: React.ReactNode }) =>
        ReactModule.createElement('AnimatedText', props, children),
    },
    Easing: { bezier: () => undefined },
    interpolateColor: () => '#ffffff',
    useReducedMotion: () => false,
    useSharedValue: (value: number) => ({ get: () => value, set: vi.fn() }),
    useAnimatedStyle: (fn: () => unknown) => passthroughStyle(fn()),
    withTiming: (value: number) => value,
  };
});

vi.mock('expo-router/ui', () => ({
  TabTrigger: ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

vi.mock('@/hooks/use-resolved-data-mode', () => ({
  useResolvedDataMode: () => ({
    hostedMode: mocks.hostedMode,
    resolved: mocks.dataModeResolved,
  }),
}));

vi.mock('@/services/tour-demo', () => ({
  resetTourDemoData: mocks.resetTourDemoData,
}));

vi.mock('@/stores/auth-ui-store', () => ({
  useAuthUiStore: (
    selector: (state: {
      isAuthenticated: boolean;
      tourModeEnabled: boolean;
      tourInitError: string | null;
      setTourInitError: (message: string | null) => void;
    }) => unknown,
  ) =>
    selector({
      isAuthenticated: mocks.isAuthenticated,
      tourModeEnabled: mocks.tourModeEnabled,
      tourInitError: mocks.tourInitError,
      setTourInitError: mocks.setTourInitError,
    }),
}));

function findText(root: renderer.ReactTestRenderer, text: string) {
  return root.root.findAll(
    (node: renderer.ReactTestInstance) => String(node.type) === 'Text' && node.props.children === text,
  );
}

function pressableLabels(root: renderer.ReactTestRenderer): string[] {
  return root.root
    .findAll((node: renderer.ReactTestInstance) => String(node.type) === 'Pressable')
    .map((node) => node.props.accessibilityLabel)
    .filter((label): label is string => typeof label === 'string');
}

describe('WorkspaceHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pathname = '/dashboard';
    mocks.hostedMode = true;
    mocks.dataModeResolved = true;
    mocks.isAuthenticated = false;
    mocks.tourModeEnabled = false;
    mocks.tourInitError = null;
  });

  it('shows the four primary tabs and a Settings gear, not Projects/Bank/Payments', async () => {
    const { WorkspaceHeader } = await import('@/components/workspace-header');

    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(<WorkspaceHeader />);
    });

    const labels = pressableLabels(root);
    expect(labels).toEqual(expect.arrayContaining(['Dashboard', 'Sessions', 'Invoices', 'Mercury', 'Settings']));
    expect(labels).not.toEqual(expect.arrayContaining(['Projects', 'Bank', 'Payments']));
    expect(findText(root, 'Projects')).toHaveLength(0);
    expect(findText(root, 'Bank')).toHaveLength(0);
    expect(findText(root, 'Payments')).toHaveLength(0);
  });

  it('shows Sign In while touring in local mode (not hosted)', async () => {
    mocks.hostedMode = false;
    mocks.tourModeEnabled = true;
    mocks.isAuthenticated = false;
    const { WorkspaceHeader } = await import('@/components/workspace-header');

    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(<WorkspaceHeader />);
    });

    expect(findText(root, 'Sign In')).toHaveLength(1);
    expect(findText(root, 'Reset Tour')).toHaveLength(1);
  });

  it('shows Sign In while touring in hosted mode', async () => {
    mocks.hostedMode = true;
    mocks.tourModeEnabled = true;
    mocks.isAuthenticated = false;
    const { WorkspaceHeader } = await import('@/components/workspace-header');

    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(<WorkspaceHeader />);
    });

    expect(findText(root, 'Sign In')).toHaveLength(1);
  });

  it('hides the mode banner entirely once authenticated and not touring', async () => {
    mocks.hostedMode = true;
    mocks.tourModeEnabled = false;
    mocks.isAuthenticated = true;
    const { WorkspaceHeader } = await import('@/components/workspace-header');

    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(<WorkspaceHeader />);
    });

    expect(findText(root, 'Sign In')).toHaveLength(0);
    expect(findText(root, 'Reset Tour')).toHaveLength(0);
  });

  it('shows Sign In for a signed-out hosted user who is not touring', async () => {
    mocks.hostedMode = true;
    mocks.tourModeEnabled = false;
    mocks.isAuthenticated = false;
    const { WorkspaceHeader } = await import('@/components/workspace-header');

    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(<WorkspaceHeader />);
    });

    expect(findText(root, 'Sign In')).toHaveLength(1);
    expect(findText(root, 'Reset Tour')).toHaveLength(0);
  });

  it('hides the banner for signed-out local users who are not touring', async () => {
    mocks.hostedMode = false;
    mocks.tourModeEnabled = false;
    mocks.isAuthenticated = false;
    const { WorkspaceHeader } = await import('@/components/workspace-header');

    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(<WorkspaceHeader />);
    });

    expect(findText(root, 'Sign In')).toHaveLength(0);
    expect(findText(root, 'Reset Tour')).toHaveLength(0);
  });
});
