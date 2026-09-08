import React from 'react';
import renderer from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  loadGateSnapshot: vi.fn(),
  markStepCompleted: vi.fn(),
  routerPush: vi.fn(),
  setOnboardingGateError: vi.fn(),
  syncOnboardingGate: vi.fn(),
  syncPendingProgress: vi.fn(),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('react-native', async () => {
  const ReactModule = await import('react');

  function makeComponent(name: string) {
    return ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactModule.createElement(name, props, children);
  }

  return {
    Platform: { OS: 'web' },
    Pressable: makeComponent('Pressable'),
    ScrollView: makeComponent('ScrollView'),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
      flatten: (styles: unknown) => styles,
    },
    Text: makeComponent('Text'),
    View: makeComponent('View'),
  };
});

vi.mock('expo-router', () => ({
  useRouter: () => ({ push: mocks.routerPush }),
}));

vi.mock('@/features/onboarding/onboarding-state', () => ({
  loadTime2PayOnboardingGateSnapshot: mocks.loadGateSnapshot,
  markPublicOnboardingStepCompleted: mocks.markStepCompleted,
  syncPendingTime2PayOnboardingProgress: mocks.syncPendingProgress,
}));

vi.mock('@/stores/auth-ui-store', () => ({
  useAuthUiStore: (
    selector: (state: {
      isAuthenticated: boolean;
      setOnboardingGateError: typeof mocks.setOnboardingGateError;
      syncOnboardingGate: typeof mocks.syncOnboardingGate;
    }) => unknown,
  ) =>
    selector({
      isAuthenticated: true,
      setOnboardingGateError: mocks.setOnboardingGateError,
      syncOnboardingGate: mocks.syncOnboardingGate,
    }),
}));

describe('OnboardingFeaturesScreen', () => {
  beforeEach(() => {
    mocks.loadGateSnapshot.mockResolvedValue({
      status: 'needs-legal',
      completedStepIds: ['welcome', 'features', 'auth'],
      missingDocumentIds: ['terms', 'privacy'],
    });
    mocks.syncPendingProgress.mockResolvedValue(undefined);
    mocks.markStepCompleted.mockClear();
    mocks.routerPush.mockClear();
    mocks.setOnboardingGateError.mockClear();
    mocks.syncOnboardingGate.mockClear();
  });

  it('syncs public onboarding progress before sending authenticated users to legal', async () => {
    const { default: OnboardingFeaturesScreen } = await import(
      '@/features/onboarding/features-screen'
    );
    let instance: renderer.ReactTestRenderer | null = null;

    await renderer.act(async () => {
      instance = renderer.create(<OnboardingFeaturesScreen />);
    });

    expect(instance).not.toBeNull();
    const renderedInstance = instance as unknown as renderer.ReactTestRenderer;
    const continueButton = renderedInstance.root.findByProps({
      accessibilityRole: 'button',
    });

    await renderer.act(async () => {
      continueButton?.props.onPress();
    });

    expect(mocks.markStepCompleted).toHaveBeenCalledWith('features');
    expect(mocks.syncPendingProgress).toHaveBeenCalled();
    expect(mocks.syncOnboardingGate).toHaveBeenCalledWith({
      status: 'needs-legal',
      completedStepIds: ['welcome', 'features', 'auth'],
      missingLegalDocumentIds: ['terms', 'privacy'],
    });
    expect(mocks.routerPush).toHaveBeenCalledWith('/onboarding/legal');
  });
});
