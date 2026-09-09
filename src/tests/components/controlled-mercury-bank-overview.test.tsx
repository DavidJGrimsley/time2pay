import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function component(name: string) {
  return function MockComponent({ children, ...props }: { children?: React.ReactNode }) {
    return React.createElement(name, props, children);
  };
}

vi.mock('react-native', () => ({
  Image: component('Image'),
  Text: component('Text'),
  View: component('View'),
}));
vi.mock('@mr.dj2u/mercury', () => ({
  findBestCheckingAccount: (accounts: unknown[]) => accounts[0] ?? null,
}));
vi.mock('@mr.dj2u/mercury-ui', () => ({
  AccountsSelect: component('AccountsSelect'),
  MercuryLogo: component('MercuryLogo'),
  MercuryStatusNotice: component('MercuryStatusNotice'),
}));
vi.mock('@/components/mercury-loading-panel', () => ({
  MercuryLoadingPanel: component('MercuryLoadingPanel'),
}));
vi.mock('@/services/mercury', () => ({
  getCachedMercuryAccountsSnapshot: () => null,
}));

describe('ControlledMercuryBankOverview', () => {
  it('loads the latest transactions for the selected OAuth-readable account', async () => {
    const adapter = {
      listAccounts: vi.fn().mockResolvedValue([
        {
          id: 'account-1',
          name: 'Operating',
          balances: { available: 100, current: 90 },
        },
      ]),
      listTransactions: vi.fn().mockResolvedValue([
        {
          id: 'transaction-1',
          amount: -12,
          counterpartyName: 'Mercury Coffee',
          status: 'sent',
          postedAt: '2026-09-08T12:00:00.000Z',
        },
      ]),
    };
    const { ControlledMercuryBankOverview } = await import(
      '@/components/controlled-mercury-bank-overview'
    );
    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(<ControlledMercuryBankOverview adapter={adapter} />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(adapter.listAccounts).toHaveBeenCalledOnce();
    expect(adapter.listTransactions).toHaveBeenCalledWith('account-1', 25);
    const text = root.root
      .findAll((node) => String(node.type) === 'Text')
      .map((node) => node.props.children)
      .flat(Infinity);
    expect(text).toContain('Recent transactions');
    expect(text).toContain('Mercury Coffee');
    expect(text).toContain('-$12.00');
  });
});
