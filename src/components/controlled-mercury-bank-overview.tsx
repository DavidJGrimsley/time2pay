import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { findBestCheckingAccount, type MercuryAccount } from '@mr.dj2u/mercury';
import {
  AccountsSelect,
  MercuryLogo,
  MercuryStatusNotice,
  type MercuryStatusTone,
  type MercuryUiAdapter,
} from '@mr.dj2u/mercury-ui';
import { MercuryLoadingPanel } from '@/components/mercury-loading-panel';
import { getCachedMercuryAccountsSnapshot } from '@/services/mercury';

type ControlledMercuryBankOverviewProps = {
  adapter: Pick<MercuryUiAdapter, 'listAccounts'>;
  subtitle?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function formatMoney(value: unknown): string {
  const amount =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(amount)) {
    return 'Unavailable';
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(amount);
}

export function ControlledMercuryBankOverview({
  adapter,
  subtitle = 'Mercury account context for invoice routing.',
}: ControlledMercuryBankOverviewProps) {
  const cachedAccounts = getCachedMercuryAccountsSnapshot();
  const cachedDefaultAccount = cachedAccounts
    ? findBestCheckingAccount(cachedAccounts) ?? cachedAccounts[0] ?? null
    : null;
  const [accounts, setAccounts] = useState<MercuryAccount[]>(() => cachedAccounts ?? []);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(() =>
    cachedDefaultAccount?.id ? `${cachedDefaultAccount.id}` : null,
  );
  const [isLoading, setIsLoading] = useState(() => cachedAccounts === null);
  const [status, setStatus] = useState(() => ({
    message:
      cachedAccounts === null
        ? 'Checking Mercury accounts...'
        : cachedAccounts.length > 0
          ? 'Mercury accounts synced.'
          : 'No Mercury accounts found.',
    tone: (cachedAccounts === null ? 'neutral' : cachedAccounts.length > 0 ? 'success' : 'error') as MercuryStatusTone,
  }));

  useEffect(() => {
    let active = true;

    async function loadAccounts(): Promise<void> {
      if (!adapter.listAccounts) {
        if (!active) {
          return;
        }

        setStatus({
          message: 'Mercury account loading is unavailable because no listAccounts adapter was provided.',
          tone: 'error',
        });
        setIsLoading(false);
        return;
      }

      if (getCachedMercuryAccountsSnapshot() === null) {
        setIsLoading(true);
      }
      try {
        const rows = await adapter.listAccounts();
        if (!active) {
          return;
        }

        const defaultAccount = findBestCheckingAccount(rows) ?? rows[0] ?? null;
        setAccounts(rows);
        setSelectedAccountId(defaultAccount?.id ? `${defaultAccount.id}` : null);
        setStatus({
          message: rows.length > 0 ? 'Mercury accounts synced.' : 'No Mercury accounts found.',
          tone: rows.length > 0 ? 'success' : 'error',
        });
      } catch (error: unknown) {
        if (!active) {
          return;
        }

        setStatus({
          message: error instanceof Error ? error.message : 'Failed to load Mercury accounts.',
          tone: 'error',
        });
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    loadAccounts().catch(() => undefined);

    return () => {
      active = false;
    };
  }, [adapter]);

  const selectedAccount = useMemo(() => {
    if (accounts.length === 0) {
      return null;
    }

    if (selectedAccountId) {
      const directMatch = accounts.find((account) => `${account.id ?? ''}` === `${selectedAccountId}`);
      if (directMatch) {
        return directMatch;
      }
    }

    return findBestCheckingAccount(accounts) ?? accounts[0] ?? null;
  }, [accounts, selectedAccountId]);

  const balances = asRecord(selectedAccount?.balances ?? null);
  const available = balances?.available ?? balances?.availableBalance ?? selectedAccount?.availableBalance;
  const current = balances?.current ?? balances?.currentBalance ?? selectedAccount?.currentBalance;

  if (isLoading) {
    return <MercuryLoadingPanel subtitle={subtitle} message="Checking Mercury accounts..." />;
  }

  return (
    <View
      style={{
        gap: 16,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#314233',
        backgroundColor: '#0f1711',
        padding: 20,
      }}
    >
      <View style={{ gap: 8 }}>
        <MercuryLogo variant="horizontal" size={280} />
        <Text style={{ color: '#d4e0d0', fontSize: 14 }}>{subtitle}</Text>
      </View>

      {accounts.length > 0 ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <Text style={{ color: '#d4e0d0', fontSize: 14, fontWeight: '700' }}>Account overview</Text>
          <AccountsSelect
            accounts={accounts}
            selectedAccountId={selectedAccountId}
            onSelect={setSelectedAccountId}
            variant="dropdown"
            hideLabel
            dropdownWidth={320}
          />
        </View>
      ) : (
        <MercuryStatusNotice message={status.message} tone={status.tone} />
      )}

      {!selectedAccount ? (
        <Text style={{ color: '#d4e0d0', fontSize: 14 }}>No account data available.</Text>
      ) : (
        <View
          style={{
            gap: 8,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: '#2f4333',
            padding: 16,
          }}
        >
          <Text style={{ color: '#f4fff4', fontSize: 17, fontWeight: '700' }}>
            {selectedAccount.nickname ?? selectedAccount.name ?? 'Mercury account'}
          </Text>
          <Text style={{ color: '#d4e0d0', fontSize: 14 }}>
            Account ID: {`${selectedAccount.id ?? 'n/a'}`}
          </Text>
          <Text style={{ color: '#d4e0d0', fontSize: 14 }}>Available: {formatMoney(available)}</Text>
          <Text style={{ color: '#d4e0d0', fontSize: 14 }}>Current: {formatMoney(current)}</Text>
        </View>
      )}
    </View>
  );
}
