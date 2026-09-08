import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  hostedMode: true,
  dataModeResolved: true,
  tourModeEnabled: false,
  startTour: vi.fn(),
  endTour: vi.fn(),
  resetForLocalMode: vi.fn(),
  routerReplace: vi.fn(),
  routerPush: vi.fn(),
  listeners: new Set<() => void>(),
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
  TextInput: makeComponent('TextInput'),
  View: makeComponent('View'),
  Platform: { OS: 'web' },
}));

vi.mock('@expo/vector-icons', () => ({
  Octicons: makeComponent('Octicons'),
}));

vi.mock('expo-router', () => ({
  Redirect: (props: { href: string }) => React.createElement('Redirect', props),
  useRouter: () => ({ replace: mocks.routerReplace, push: mocks.routerPush }),
}));

vi.mock('@/components/app-loading-shell', () => ({
  AppLoadingShell: () => React.createElement('AppLoadingShell'),
}));

vi.mock('@/services/supabase-client', () => ({
  signInWithGitHubOAuth: vi.fn(),
  signInWithMagicLink: vi.fn(),
}));

vi.mock('@/hooks/use-resolved-data-mode', () => ({
  useResolvedDataMode: () => ({
    dataMode: mocks.hostedMode ? 'hosted' : 'local',
    hostedMode: mocks.hostedMode,
    resolved: mocks.dataModeResolved,
  }),
}));

vi.mock('@/stores/auth-ui-store', async () => {
  const ReactModule = await import('react');

  return {
    useAuthUiStore: (
      selector: (state: {
        tourModeEnabled: boolean;
        startTour: () => void;
        endTour: () => void;
        resetForLocalMode: () => void;
      }) => unknown,
    ) => {
      const subscribe = (onStoreChange: () => void) => {
        mocks.listeners.add(onStoreChange);
        return () => mocks.listeners.delete(onStoreChange);
      };
      const getSnapshot = () =>
        selector({
          tourModeEnabled: mocks.tourModeEnabled,
          startTour: mocks.startTour,
          endTour: mocks.endTour,
          resetForLocalMode: mocks.resetForLocalMode,
        });

      return ReactModule.useSyncExternalStore(subscribe, getSnapshot);
    },
  };
});

describe('SignInRoute tour exit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hostedMode = true;
    mocks.dataModeResolved = true;
    mocks.tourModeEnabled = false;
    mocks.listeners.clear();
    // endTour flips tourModeEnabled to false and notifies subscribers, mirroring
    // the real Zustand store's reactivity.
    mocks.endTour.mockImplementation(() => {
      mocks.tourModeEnabled = false;
      mocks.listeners.forEach((listener) => listener());
    });
  });

  it('exits tour mode in hosted mode without touching local-mode reset', async () => {
    mocks.hostedMode = true;
    mocks.tourModeEnabled = true;
    const { default: SignInRoute } = await import('@/app/sign-in');

    await act(async () => {
      renderer.create(<SignInRoute />);
    });

    expect(mocks.endTour).toHaveBeenCalledTimes(1);
    expect(mocks.resetForLocalMode).not.toHaveBeenCalled();
  });

  it('exits tour mode and resets local mode before redirecting to /dashboard', async () => {
    mocks.hostedMode = false;
    mocks.tourModeEnabled = true;
    const { default: SignInRoute } = await import('@/app/sign-in');

    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(<SignInRoute />);
    });

    expect(mocks.endTour).toHaveBeenCalledTimes(1);
    expect(mocks.resetForLocalMode).toHaveBeenCalledTimes(1);

    const redirect = root.root.findAll(
      (node: renderer.ReactTestInstance) => String(node.type) === 'Redirect',
    );
    expect(redirect).toHaveLength(1);
    expect(redirect[0]?.props.href).toBe('/dashboard');
  });

  it('does not call endTour when not touring', async () => {
    mocks.hostedMode = false;
    mocks.tourModeEnabled = false;
    const { default: SignInRoute } = await import('@/app/sign-in');

    await act(async () => {
      renderer.create(<SignInRoute />);
    });

    expect(mocks.endTour).not.toHaveBeenCalled();
    expect(mocks.resetForLocalMode).not.toHaveBeenCalled();
  });
});
