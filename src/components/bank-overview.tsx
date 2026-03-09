import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { listMercuryAccounts } from '@/services/mercury';
import { InlineNotice, type NoticeTone } from '@/components/inline-notice';
import { showActionErrorAlert } from '@/services/system-alert';

type RecordValue = Record<string, unknown>;
type StatusNotice = {
  message: string;
  tone: NoticeTone;
};

function asRecord(input: unknown): RecordValue | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return null;
  }
  return input as RecordValue;
}

function findCheckingAccount(accounts: unknown[]): RecordValue | null {
  const records = accounts.map(asRecord).filter((value): value is RecordValue => value !== null);
  if (records.length === 0) {
    return null;
  }

  const checking = records.find((account) => {
    const type = `${account.accountType ?? account.kind ?? ''}`.toLowerCase();
    const nickname = `${account.nickname ?? account.name ?? ''}`.toLowerCase();
    return type.includes('checking') || nickname.includes('checking');
  });

  return checking ?? records[0] ?? null;
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
  const [accounts, setAccounts] = useState<unknown[]>([]);
  const [status, setStatus] = useState<StatusNotice>({
    message: 'Loading Mercury accounts...',
    tone: 'neutral',
  });
  const [loading, setLoading] = useState(false);

  const checkingAccount = useMemo(() => findCheckingAccount(accounts), [accounts]);

  async function refreshAccounts(source: 'initial' | 'user' = 'user'): Promise<void> {
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
      if (source === 'user') {
        showActionErrorAlert(message);
      }
      setStatus({ message, tone: 'error' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshAccounts('initial').catch(() => undefined);
  }, []);

  const balances = asRecord(checkingAccount?.balances ?? null);
  const available = balances?.available ?? balances?.availableBalance ?? checkingAccount?.availableBalance;
  const current = balances?.current ?? balances?.currentBalance ?? checkingAccount?.currentBalance;

  return (
    <View className="gap-3">
      <Text className="text-3xl font-extrabold text-heading">Bank</Text>
      <Text className="text-muted">
        Mercury checking visibility. Use this to confirm your account context before sending invoices.
      </Text>

      <View className="gap-2 rounded-xl bg-card p-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-xl font-bold text-heading">Checking Account</Text>
          <Pressable
            className="rounded-md border border-border px-3 py-1.5"
            onPress={() => refreshAccounts('user')}
            disabled={loading}
          >
            <Text className="font-semibold text-heading">{loading ? 'Refreshing...' : 'Refresh'}</Text>
          </Pressable>
        </View>

        <InlineNotice tone={status.tone} message={status.message} />

        {!checkingAccount ? (
          <Text className="text-sm text-muted">No account data available.</Text>
        ) : (
          <View className="gap-1">
            <Text className="font-semibold text-heading">
              {`${checkingAccount.nickname ?? checkingAccount.name ?? 'Primary account'}`}
            </Text>
            <Text className="text-sm text-muted">
              Account ID: {`${checkingAccount.id ?? 'n/a'}`}
            </Text>
            <Text className="text-sm text-muted">
              Available: {formatMoney(available)}
            </Text>
            <Text className="text-sm text-muted">
              Current: {formatMoney(current)}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
