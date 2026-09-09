import React from 'react';
import { Pressable, Text } from 'react-native';
import renderer from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  completeOnboarding: vi.fn(),
  getReferralStatus: vi.fn(),
  loadGateSnapshot: vi.fn(),
  openUrl: vi.fn(),
  oauthIsLoading: false,
  oauthStatus: null as null | {
    available: boolean;
    connectionState: 'disconnected' | 'connected' | 'reauthorization_required';
    environment: 'sandbox' | 'production' | null;
    scopes: string[];
    connectedAt: string | null;
    lastRefreshedAt: string | null;
    accessTokenExpiresAt: string | null;
  },
  recordChoice: vi.fn(),
  routerPush: vi.fn(),
  routerReplace: vi.fn(),
  setOnboardingGateError: vi.fn(),
  syncOnboardingGate: vi.fn(),
  startMercuryOAuth: vi.fn(),
  trackReferralClick: vi.fn(),
  windowLocationAssign: vi.fn(),
  windowReplaceState: vi.fn(),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('react-native', async () => {
  const ReactModule = await import('react');

  function makeComponent(name: string) {
    return ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactModule.createElement(name, props, children);
  }

  return {
    Linking: { openURL: mocks.openUrl },
    Platform: { OS: 'web' },
    Pressable: makeComponent('Pressable'),
    ScrollView: makeComponent('ScrollView'),
    StyleSheet: { create: (styles: Record<string, unknown>) => styles },
    Text: makeComponent('Text'),
    View: makeComponent('View'),
  };
});

vi.mock('expo-router', () => ({
  useRouter: () => ({ push: mocks.routerPush, replace: mocks.routerReplace }),
}));

vi.mock('@/components/app-loading-shell', () => ({
  AppLoadingShell: () => React.createElement('AppLoadingShell'),
}));

vi.mock('@/components/inline-notice', () => ({
  InlineNotice: ({ message }: { message: string }) => React.createElement('Notice', { message }),
}));

vi.mock('@/components/mercury-disclosure', () => ({
  MERCURY_AFFILIATE_LINK_DISCLOSURE: 'Affiliate disclosure',
  MercuryDisclosure: () => React.createElement('MercuryDisclosure'),
  MercuryPoweredBy: () => React.createElement('MercuryPoweredBy'),
}));

vi.mock('@/services/mercury-referrals', () => ({
  getMercuryReferralStatus: mocks.getReferralStatus,
  MERCURY_REFERRAL_URL: 'https://mercury.com/r/time2pay',
  trackMercuryReferralClick: mocks.trackReferralClick,
}));

vi.mock('@/services/mercury-oauth', () => ({
  startMercuryOAuth: mocks.startMercuryOAuth,
}));

vi.mock('@/hooks/use-mercury-oauth-status', () => ({
  useMercuryOAuthStatus: () => ({
    isLoading: mocks.oauthIsLoading,
    status: mocks.oauthStatus,
  }),
}));

vi.mock('@/stores/auth-ui-store', () => ({
  useAuthUiStore: (
    selector: (state: {
      authReady: boolean;
      isAuthenticated: boolean;
      setOnboardingGateError: typeof mocks.setOnboardingGateError;
      syncOnboardingGate: typeof mocks.syncOnboardingGate;
    }) => unknown,
  ) =>
    selector({
      authReady: true,
      isAuthenticated: true,
      setOnboardingGateError: mocks.setOnboardingGateError,
      syncOnboardingGate: mocks.syncOnboardingGate,
    }),
}));

vi.mock('@/theme/provider', () => ({
  useAppTheme: () => ({
    activeColors: {
      background: '#ffffff',
      primary: '#111827',
      secondary: '#94a3b8',
      success: '#15803d',
      surface: '#f8fafc',
      text: '#0f172a',
      warning: '#a16207',
    },
    colors: { light: { text: '#0f172a' } },
    layout: { radius: 12 },
    typography: { fontTitle: 'System' },
  }),
}));

vi.mock('@/features/onboarding/onboarding-state', () => ({
  completeTime2PayOnboarding: mocks.completeOnboarding,
  loadTime2PayOnboardingGateSnapshot: mocks.loadGateSnapshot,
  recordTime2PayMercuryOnboardingChoice: mocks.recordChoice,
}));

function pressableWithText(root: renderer.ReactTestInstance, label: string) {
  return root.findAllByType(Pressable).find((pressable) =>
    pressable
      .findAllByType(Text)
      .some((textNode) => React.Children.toArray(textNode.props.children).join('') === label),
  );
}

describe('MercuryOnboardingScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.completeOnboarding.mockResolvedValue(undefined);
    mocks.getReferralStatus.mockResolvedValue(null);
    mocks.loadGateSnapshot.mockResolvedValue({
      status: 'complete',
      completedStepIds: ['welcome', 'features', 'auth', 'legal', 'mercury'],
      missingDocumentIds: [],
    });
    mocks.openUrl.mockResolvedValue(undefined);
    mocks.oauthIsLoading = false;
    mocks.oauthStatus = {
      available: true,
      connectionState: 'disconnected',
      environment: 'sandbox',
      scopes: [],
      connectedAt: null,
      lastRefreshedAt: null,
      accessTokenExpiresAt: null,
    };
    mocks.recordChoice.mockResolvedValue(undefined);
    mocks.startMercuryOAuth.mockResolvedValue({
      authorizationUrl: 'https://oauth2-sandbox.mercury.com/oauth2/auth',
    });
    mocks.trackReferralClick.mockResolvedValue({ status: 'clicked' });
    vi.stubGlobal('window', {
      history: { replaceState: mocks.windowReplaceState },
      location: {
        assign: mocks.windowLocationAssign,
        hash: '',
        pathname: '/onboarding/mercury',
        search: '',
      },
    });
  });

  it('records Not now and finishes the optional step', async () => {
    const { default: MercuryOnboardingScreen } = await import(
      '@/features/onboarding/mercury-onboarding-screen'
    );
    let instance!: renderer.ReactTestRenderer;

    await renderer.act(async () => {
      instance = renderer.create(<MercuryOnboardingScreen />);
    });

    const notNowButton = pressableWithText(instance.root, 'Not now');
    expect(notNowButton).toBeDefined();

    await renderer.act(async () => {
      notNowButton?.props.onPress();
      await Promise.resolve();
    });

    expect(mocks.recordChoice).toHaveBeenCalledWith('not-now');
    expect(mocks.completeOnboarding).toHaveBeenCalledTimes(1);
    expect(mocks.syncOnboardingGate).toHaveBeenCalledWith({
      status: 'complete',
      completedStepIds: ['welcome', 'features', 'auth', 'legal', 'mercury'],
      missingLegalDocumentIds: [],
    });
    expect(mocks.routerReplace).toHaveBeenCalledWith('/dashboard');
  });

  it('starts basic read OAuth from the existing-customer path and returns to onboarding', async () => {
    const { default: MercuryOnboardingScreen } = await import(
      '@/features/onboarding/mercury-onboarding-screen'
    );
    let instance!: renderer.ReactTestRenderer;

    await renderer.act(async () => {
      instance = renderer.create(<MercuryOnboardingScreen />);
    });

    await renderer.act(async () => {
      pressableWithText(instance.root, 'I already use Mercury')?.props.onPress();
    });

    expect(instance.root.findByProps({ testID: 'mercury-read-connection-panel' })).toBeDefined();
    expect(
      instance.root.findAllByType(Text).some((node) => node.props.children === 'Basic read access'),
    ).toBe(true);

    await renderer.act(async () => {
      pressableWithText(instance.root, 'Connect Mercury')?.props.onPress();
      await Promise.resolve();
    });
    expect(mocks.startMercuryOAuth).toHaveBeenCalledWith('/onboarding/mercury');
    expect(mocks.windowLocationAssign).toHaveBeenCalledWith(
      'https://oauth2-sandbox.mercury.com/oauth2/auth',
    );
  });

  it('shows the connected state without mixing in advanced access', async () => {
    mocks.oauthStatus = {
      available: true,
      connectionState: 'connected',
      environment: 'sandbox',
      scopes: ['read', 'offline_access'],
      connectedAt: '2026-09-09T12:00:00.000Z',
      lastRefreshedAt: null,
      accessTokenExpiresAt: '2026-09-09T13:00:00.000Z',
    };
    const { default: MercuryOnboardingScreen } = await import(
      '@/features/onboarding/mercury-onboarding-screen'
    );
    let instance!: renderer.ReactTestRenderer;

    await renderer.act(async () => {
      instance = renderer.create(<MercuryOnboardingScreen />);
    });
    await renderer.act(async () => {
      pressableWithText(instance.root, 'I already use Mercury')?.props.onPress();
    });

    expect(instance.root.findByProps({ message: 'Mercury is connected with basic read access.' })).toBeDefined();
    expect(pressableWithText(instance.root, 'Connect Mercury')).toBeUndefined();
    expect(
      instance.root
        .findAllByType(Text)
        .some((node) => node.props.children === 'Advanced access is separate'),
    ).toBe(true);
  });

  it('opens and tracks the partner link for a new Mercury customer', async () => {
    const { default: MercuryOnboardingScreen } = await import(
      '@/features/onboarding/mercury-onboarding-screen'
    );
    let instance!: renderer.ReactTestRenderer;

    await renderer.act(async () => {
      instance = renderer.create(<MercuryOnboardingScreen />);
    });

    await renderer.act(async () => {
      pressableWithText(instance.root, 'I need a Mercury account')?.props.onPress();
    });
    expect(instance.root.findByProps({ testID: 'mercury-referral-panel' })).toBeDefined();

    await renderer.act(async () => {
      pressableWithText(instance.root, 'Open Mercury through Time2Pay')?.props.onPress();
      await Promise.resolve();
    });

    expect(mocks.openUrl).toHaveBeenCalledWith('https://mercury.com/r/time2pay');
    expect(mocks.trackReferralClick).toHaveBeenCalledTimes(1);
  });
});
