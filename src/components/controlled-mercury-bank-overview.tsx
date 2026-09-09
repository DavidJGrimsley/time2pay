import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import {
  findBestCheckingAccount,
  type MercuryAccount,
  type MercuryTransaction,
} from '@mr.dj2u/mercury';
import {
  AccountsSelect,
  MercuryLogo,
  MercuryStatusNotice,
  type MercuryStatusTone,
  type MercuryUiAdapter,
} from '@mr.dj2u/mercury-ui';
import { MercuryLoadingPanel } from '@/components/mercury-loading-panel';
import { MercuryPoweredBy } from '@/components/mercury-disclosure';
import { getCachedMercuryAccountsSnapshot } from '@/services/mercury';

type ControlledMercuryBankOverviewProps = {
  adapter: Pick<MercuryUiAdapter, 'listAccounts'> & {
    listTransactions: (accountId: string, limit?: number) => Promise<MercuryTransaction[]>;
  };
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

function firstText(record: MercuryTransaction, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function formatTransactionDate(transaction: MercuryTransaction): string {
  const value = firstText(transaction, ['postedAt', 'createdAt', 'date', 'estimatedDeliveryDate']);
  if (!value) return 'Date unavailable';
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp)
    ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(timestamp))
    : value;
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
  const [transactions, setTransactions] = useState<MercuryTransaction[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [transactionError, setTransactionError] = useState<string | null>(null);
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

  useEffect(() => {
    const accountId = selectedAccount?.id ? `${selectedAccount.id}` : '';
    if (!accountId) {
      setTransactions([]);
      setTransactionError(null);
      return;
    }

    let active = true;
    setIsLoadingTransactions(true);
    setTransactionError(null);
    adapter
      .listTransactions(accountId, 25)
      .then((rows) => {
        if (active) setTransactions(rows);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setTransactions([]);
        setTransactionError(
          error instanceof Error ? error.message : 'Failed to load recent transactions.',
        );
      })
      .finally(() => {
        if (active) setIsLoadingTransactions(false);
      });

    return () => {
      active = false;
    };
  }, [adapter, selectedAccount?.id]);

  if (isLoading) {
    return (
      <MercuryLoadingPanel
        subtitle={subtitle}
        message="Checking Mercury accounts..."
        headerAccessory={<MercuryPoweredBy />}
      />
    );
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
        <View
          style={{
            alignItems: 'flex-start',
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 12,
            justifyContent: 'space-between',
          }}
        >
          <MercuryLogo variant="horizontal" size={280} />
          <MercuryPoweredBy />
        </View>
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

      {selectedAccount ? (
        <View style={{ gap: 10 }}>
          <Text style={{ color: '#f4fff4', fontSize: 16, fontWeight: '700' }}>
            Recent transactions
          </Text>
          {isLoadingTransactions ? (
            <Text style={{ color: '#d4e0d0', fontSize: 14 }}>Loading transactions...</Text>
          ) : transactionError ? (
            <MercuryStatusNotice message={transactionError} tone="error" />
          ) : transactions.length === 0 ? (
            <Text style={{ color: '#d4e0d0', fontSize: 14 }}>No recent transactions found.</Text>
          ) : (
            transactions.map((transaction, index) => {
              const description =
                firstText(transaction, [
                  'counterpartyName',
                  'bankDescription',
                  'note',
                  'kind',
                ]) ?? 'Mercury transaction';
              const statusText = firstText(transaction, ['status']);
              return (
                <View
                  key={`${transaction.id ?? 'transaction'}-${index}`}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    gap: 12,
                    borderTopWidth: index === 0 ? 0 : 1,
                    borderTopColor: '#2f4333',
                    paddingTop: index === 0 ? 0 : 10,
                  }}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ color: '#f4fff4', fontSize: 14, fontWeight: '600' }}>
                      {description}
                    </Text>
                    <Text style={{ color: '#aebcab', fontSize: 12 }}>
                      {formatTransactionDate(transaction)}
                      {statusText ? ` · ${statusText}` : ''}
                    </Text>
                  </View>
                  <Text style={{ color: '#f4fff4', fontSize: 14, fontWeight: '700' }}>
                    {formatMoney(transaction.amount)}
                  </Text>
                </View>
              );
            })
          )}
        </View>
      ) : null}
    </View>
  );
}
