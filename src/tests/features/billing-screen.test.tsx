import React from 'react';
import renderer from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HostedAccessResult } from '@/database/hosted/billing/types';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  searchParams: {} as { checkout?: string; session_id?: string },
  colorScheme: 'dark' as 'light' | 'dark' | null,
  getHostedBillingStatus: vi.fn(),
  syncHostedBilling: vi.fn(),
  createHostedCheckout: vi.fn(),
  createBillingPaymentMethodSetup: vi.fn(),
  getBillingSubscription: vi.fn(),
  updateBillingPaymentMethod: vi.fn(),
  updateBillingSubscription: vi.fn(),
  getMercuryReferralStatus: vi.fn(),
}));

vi.mock('react-native', async () => {
  const ReactModule = await import('react');

  function makeComponent(name: string) {
    return ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactModule.createElement(name, props, children);
  }

  return {
    ActivityIndicator: makeComponent('ActivityIndicator'),
    Linking: { openURL: vi.fn() },
    Pressable: makeComponent('Pressable'),
    ScrollView: makeComponent('ScrollView'),
    Text: makeComponent('Text'),
    useColorScheme: () => mocks.colorScheme,
    View: makeComponent('View'),
  };
});

vi.mock('react-native-reanimated', async () => {
  const ReactModule = await import('react');

  return {
    __esModule: true,
    default: {
      View: ({ children, ...props }: { children?: React.ReactNode }) =>
        ReactModule.createElement('AnimatedView', props, children),
    },
    FadeIn: {
      duration: () => undefined,
    },
    FadeOut: {
      duration: () => undefined,
    },
    LinearTransition: {
      duration: () => ({}),
    },
  };
});

vi.mock('@/components/UI/Loading', async () => {
  const ReactModule = await import('react');

  return {
    CosmosLoadingAnimation: (props: { size?: number }) =>
      ReactModule.createElement('CosmosLoadingAnimation', props),
  };
});

vi.mock('expo-router', async () => {
  const ReactModule = await import('react');

  return {
    Link: ({ children }: { children?: React.ReactNode }) =>
      ReactModule.createElement(ReactModule.Fragment, null, children),
    useLocalSearchParams: () => mocks.searchParams,
  };
});

vi.mock('@/services/billing', () => ({
  createHostedCheckout: mocks.createHostedCheckout,
  createBillingPaymentMethodSetup: mocks.createBillingPaymentMethodSetup,
  getBillingSubscription: mocks.getBillingSubscription,
  getHostedBillingStatus: mocks.getHostedBillingStatus,
  syncHostedBilling: mocks.syncHostedBilling,
  updateBillingPaymentMethod: mocks.updateBillingPaymentMethod,
  updateBillingSubscription: mocks.updateBillingSubscription,
}));

vi.mock('@/services/mercury-referrals', () => ({
  getMercuryReferralStatus: mocks.getMercuryReferralStatus,
}));

vi.mock('@/services/runtime-mode', () => ({
  isHostedMode: () => true,
}));

vi.mock('@/stores/auth-ui-store', () => ({
  useAuthUiStore: (selector: (state: { isAuthenticated: boolean; tourModeEnabled: boolean }) => unknown) =>
    selector({ isAuthenticated: true, tourModeEnabled: false }),
}));

const activeAccess: HostedAccessResult = {
  hasAccess: true,
  status: 'active',
  source: 'subscription',
  validUntil: '2033-05-18T03:33:20.000Z',
  eligibleOffers: [],
};

describe('BillingScreen checkout sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.EXPO_OS = 'web';
    mocks.searchParams = {};
    mocks.colorScheme = 'dark';
    mocks.getHostedBillingStatus.mockResolvedValue(activeAccess);
    mocks.syncHostedBilling.mockResolvedValue(activeAccess);
    mocks.createHostedCheckout.mockResolvedValue({ clientSecret: 'cs_test_secret_123' });
    mocks.getBillingSubscription.mockResolvedValue({
      plan: 'annual',
      status: 'active',
      currentPeriodEnd: '2033-05-18T03:33:20.000Z',
      cancelAtPeriodEnd: false,
      paymentMethod: null,
    });
    mocks.getMercuryReferralStatus.mockResolvedValue({
      status: 'not_started',
      qualificationDeadlineAt: null,
      qualifiedAt: null,
    });
  });

  it('uses checkout sync as the initial access request after Stripe redirects back', async () => {
    mocks.searchParams = { checkout: 'success', session_id: 'cs_test_123' };
    const { BillingScreen } = await import('@/features/billing/billing-screen');

    await renderer.act(async () => {
      renderer.create(<BillingScreen variant="settings" />);
    });

    expect(mocks.syncHostedBilling).toHaveBeenCalledWith('cs_test_123', expect.any(AbortSignal));
    expect(mocks.getHostedBillingStatus).not.toHaveBeenCalled();
  });

  it('aborts a superseded checkout sync when the session id changes', async () => {
    const signals: AbortSignal[] = [];
    mocks.syncHostedBilling.mockImplementation((_checkoutSessionId?: string, signal?: AbortSignal) => {
      if (signal) {
        signals.push(signal);
      }
      return new Promise(() => undefined);
    });
    mocks.searchParams = { checkout: 'success', session_id: 'cs_old' };
    const { BillingScreen } = await import('@/features/billing/billing-screen');
    let instance: renderer.ReactTestRenderer | null = null;

    await renderer.act(async () => {
      instance = renderer.create(<BillingScreen variant="settings" />);
    });
    mocks.searchParams = { checkout: 'success', session_id: 'cs_new' };
    await renderer.act(async () => {
      instance?.update(<BillingScreen variant="settings" />);
    });

    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(false);
    expect(mocks.syncHostedBilling).toHaveBeenNthCalledWith(2, 'cs_new', expect.any(AbortSignal));

    await renderer.act(async () => {
      instance?.unmount();
    });
  });

  it('shows the subscription-access loader instead of plans until access resolves', async () => {
    mocks.getHostedBillingStatus.mockImplementation(() => new Promise(() => undefined));
    const { BillingScreen } = await import('@/features/billing/billing-screen');
    let instance!: renderer.ReactTestRenderer;

    await renderer.act(async () => {
      instance = renderer.create(<BillingScreen variant="pricing" />);
    });

    expect(
      instance.root.find(
        (node: renderer.ReactTestInstance) =>
          String(node.type) === 'Text' && node.props.children === 'Checking subscription access...',
      ),
    ).toBeTruthy();
    expect(
      instance.root.findAll(
        (node: renderer.ReactTestInstance) =>
          String(node.type) === 'Text' && node.props.children === 'Choose Annual',
      ),
    ).toHaveLength(0);
  });

  it('shows a payment-method section only when Stripe returns saved card details', async () => {
    mocks.getBillingSubscription.mockResolvedValue({
      plan: 'annual',
      status: 'active',
      currentPeriodEnd: '2033-05-18T03:33:20.000Z',
      cancelAtPeriodEnd: false,
      paymentMethod: { brand: 'visa', last4: '4242', expMonth: 8, expYear: 2030 },
    });
    mocks.createBillingPaymentMethodSetup.mockResolvedValue({ clientSecret: 'seti_secret_123' });
    const { BillingScreen } = await import('@/features/billing/billing-screen');
    let instance!: renderer.ReactTestRenderer;

    await renderer.act(async () => {
      instance = renderer.create(<BillingScreen variant="settings" />);
    });

    expect(
      instance.root.find(
        (node: renderer.ReactTestInstance) =>
          String(node.type) === 'Text' && node.props.children === 'Payment method',
      ),
    ).toBeTruthy();
    const changeButton = instance.root.find(
      (node: renderer.ReactTestInstance) =>
        String(node.type) === 'Pressable' &&
        node.findAll(
          (child: renderer.ReactTestInstance) =>
            String(child.type) === 'Text' && child.props.children === 'Change payment method',
        ).length > 0,
    );

    await renderer.act(async () => {
      changeButton.props.onPress();
    });

    expect(mocks.createBillingPaymentMethodSetup).toHaveBeenCalledTimes(1);
  });

  it('starts checkout with the current dark-mode theme after the plans panel fades away', async () => {
    const { BillingScreen } = await import('@/features/billing/billing-screen');
    mocks.getHostedBillingStatus.mockResolvedValue({
      ...activeAccess,
      eligibleOffers: ['annual', 'monthly'],
    });
    let instance!: renderer.ReactTestRenderer;

    await renderer.act(async () => {
      instance = renderer.create(<BillingScreen variant="pricing" />);
    });

    const annualButton = instance.root.find(
      (node: renderer.ReactTestInstance) =>
        String(node.type) === 'Pressable' &&
        node.findAll(
          (child: renderer.ReactTestInstance) =>
            String(child.type) === 'Text' && child.props.children === 'Choose Annual',
        ).length > 0,
    );

    await renderer.act(async () => {
      annualButton.props.onPress();
    });

    expect(mocks.createHostedCheckout).toHaveBeenCalledWith('annual', 'dark');
    expect(
      instance.root.findAll(
        (node: renderer.ReactTestInstance) =>
          String(node.type) === 'Text' && node.props.children === 'Secure checkout',
      ),
    ).toHaveLength(0);

    await renderer.act(async () => {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 280);
      });
    });

    expect(
      instance.root.find(
        (node: renderer.ReactTestInstance) =>
          String(node.type) === 'Text' && node.props.children === 'Secure checkout',
      ),
    ).toBeTruthy();
  });
});
