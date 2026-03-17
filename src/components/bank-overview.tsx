import { useEffect, useMemo, useState } from 'react';
import { Text, useWindowDimensions, View } from 'react-native';
import { findBestCheckingAccount, type MercuryAccount } from '@mrdj/mercury';
import {
  MercuryLogo,
  MercuryStatusNotice,
  type MercuryStatusTone,
} from '@mrdj/mercury-ui';
import { MercuryCustomerContactPanel } from '@/components/mercury-customer-contact-panel';
import { listMercuryAccounts } from '@/services/mercury';

type RecordValue = Record<string, unknown>;
type StatusNotice = {
  message: string;
  tone: MercuryStatusTone;
};

function asRecord(input: unknown): RecordValue | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return null;
  }
  return input as RecordValue;
}

function formatMoney(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
    }
  }

  return 'n/a';
}

export function BankOverview() {
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 1200;
  const isTablet = width >= 768 && width < 1200;
  const contentWidthStyle = isLargeScreen
    ? { width: '90%' as const, maxWidth: 1500 }
    : isTablet
      ? { width: '75%' as const }
      : { width: '90%' as const };
  const [accounts, setAccounts] = useState<MercuryAccount[]>([]);
  const [status, setStatus] = useState<StatusNotice>({
    message: 'Loading Mercury accounts...',
    tone: 'neutral',
  });
  const [loading, setLoading] = useState(false);

  const checkingAccount = useMemo(() => findBestCheckingAccount(accounts), [accounts]);

  async function refreshAccounts(): Promise<void> {
    setLoading(true);
    setStatus({ message: 'Loading Mercury accounts...', tone: 'neutral' });
    try {
      const rows = await listMercuryAccounts();
      setAccounts(rows);
      setStatus({
        message: rows.length > 0 ? `Loaded ${rows.length} account(s).` : 'No accounts found.',
        tone: 'neutral',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load Mercury accounts.';
      setStatus({ message, tone: 'error' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshAccounts().catch(() => undefined);
  }, []);

  const balances = asRecord(checkingAccount?.balances ?? null);
  const available = balances?.available ?? balances?.availableBalance ?? checkingAccount?.availableBalance;
  const current = balances?.current ?? balances?.currentBalance ?? checkingAccount?.currentBalance;
  const showCustomerContact = loading || accounts.length > 0 || status.tone !== 'error';

  return (
    <View className="gap-3">
      <Text className="text-3xl font-extrabold text-heading">Bank</Text>
      <Text className="text-muted">
        Mercury checking visibility. Use this to confirm your account context before sending invoices.
      </Text>

      <View className="items-center">
        <View className="w-full" style={contentWidthStyle}>
          <View
            className="gap-4 rounded-2xl border p-5"
            style={{ borderColor: '#314233', backgroundColor: '#0f1711' }}
          >
            <View className="flex-row items-center justify-between">
              <View className="gap-1">
                <MercuryLogo variant="horizontal" size={280} />
                <Text style={{ color: '#d4e0d0', fontSize: 14 }}>
                  Mercury account context for invoice routing.
                </Text>
              </View>
            </View>

            <View className="flex-row items-center justify-between">
              <Text style={{ color: '#d4e0d0', fontSize: 14, fontWeight: '600' }}>
                Checking account overview
              </Text>
              <Text style={{ color: '#d4e0d0', fontSize: 13 }}>
                {loading ? 'Loading...' : 'Synced'}
              </Text>
            </View>

            <MercuryStatusNotice tone={status.tone} message={status.message} />

            {!checkingAccount ? (
              <Text style={{ color: '#d4e0d0', fontSize: 14 }}>No account data available.</Text>
            ) : (
              <View className="gap-2 rounded-xl border p-4" style={{ borderColor: '#2f4333' }}>
                <Text style={{ color: '#f4fff4', fontSize: 17, fontWeight: '700' }}>
                  {`${checkingAccount.nickname ?? checkingAccount.name ?? 'Primary account'}`}
                </Text>
                <Text style={{ color: '#d4e0d0', fontSize: 14 }}>
                  Account ID: {`${checkingAccount.id ?? 'n/a'}`}
                </Text>
                <Text style={{ color: '#d4e0d0', fontSize: 14 }}>
                  Available: {formatMoney(available)}
                </Text>
                <Text style={{ color: '#d4e0d0', fontSize: 14 }}>
                  Current: {formatMoney(current)}
                </Text>
              </View>
            )}
          </View>

          <MercuryCustomerContactPanel visible={showCustomerContact} />
        </View>
      </View>
    </View>
  );
}
