import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  section: undefined as string | undefined,
  replace: vi.fn(),
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

vi.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ section: mocks.section }),
  useRouter: () => ({ replace: mocks.replace }),
}));

vi.mock('@/components/bank-overview', () => ({
  BankOverview: ({ showHeader }: { showHeader?: boolean }) =>
    React.createElement('BankOverview', { showHeader }),
}));

vi.mock('@/components/payments-overview', () => ({
  PaymentsOverview: ({ showHeader }: { showHeader?: boolean }) =>
    React.createElement('PaymentsOverview', { showHeader }),
}));

describe('MercuryOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.section = undefined;
  });

  it('shows Bank by default and can switch to Payments', async () => {
    const { MercuryOverview } = await import('@/components/mercury-overview');

    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(<MercuryOverview />);
    });

    expect(root.root.findByType('BankOverview' as never).props.showHeader).toBe(false);
    expect(root.root.findAllByType('PaymentsOverview' as never)).toHaveLength(0);

    const payments = root.root.find(
      (node: renderer.ReactTestInstance) =>
        String(node.type) === 'Pressable' && node.props.accessibilityState?.selected === false,
    );
    await act(async () => {
      payments.props.onPress();
    });

    expect(mocks.replace).toHaveBeenCalledWith({
      pathname: '/mercury',
      params: { section: 'payments' },
    });
  });

  it('renders Payments when the section query is payments', async () => {
    mocks.section = 'payments';
    const { MercuryOverview } = await import('@/components/mercury-overview');

    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(<MercuryOverview />);
    });

    expect(root.root.findByType('PaymentsOverview' as never).props.showHeader).toBe(false);
    expect(root.root.findAllByType('BankOverview' as never)).toHaveLength(0);
  });
});
