import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import type {
  MercuryAccount,
  MercuryRecipient,
  MercurySendMoneyInput,
} from '@mr.dj2u/mercury';
import {
  MercuryLogo,
  MercuryRecipientManager,
  SendMoneyForm,
  type MercuryStatusTone,
  type MercuryUiAdapter,
} from '@mr.dj2u/mercury-ui';
import { MercuryLoadingPanel } from '@/components/mercury-loading-panel';
import {
  getCachedMercuryAccountsSnapshot,
  getCachedMercuryRecipientsSnapshot,
} from '@/services/mercury';

type WorkflowStatus = {
  message: string;
  tone: MercuryStatusTone;
};

type ControlledMercurySendMoneyWorkflowProps = {
  adapter: MercuryUiAdapter;
  onError?: (message: string) => void;
};

export function ControlledMercurySendMoneyWorkflow({
  adapter,
  onError,
}: ControlledMercurySendMoneyWorkflowProps) {
  const cachedAccounts = getCachedMercuryAccountsSnapshot();
  const cachedRecipients = getCachedMercuryRecipientsSnapshot();
  const hasCachedResources = cachedAccounts !== null && cachedRecipients !== null;
  const [accounts, setAccounts] = useState<MercuryAccount[]>(() => cachedAccounts ?? []);
  const [recipients, setRecipients] = useState<MercuryRecipient[]>(() => cachedRecipients ?? []);
  const [isLoading, setIsLoading] = useState(() => !hasCachedResources);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<WorkflowStatus>(() => ({
    message: hasCachedResources
      ? 'Mercury accounts and recipients are ready.'
      : 'Checking Mercury accounts and recipients...',
    tone: hasCachedResources ? 'success' : 'neutral',
  }));

  const refreshResources = useCallback(async (): Promise<void> => {
    if (!adapter.listAccounts || !adapter.listRecipients) {
      const message = 'Mercury send-money workflow requires listAccounts and listRecipients adapters.';
      onError?.(message);
      setStatus({ message, tone: 'error' });
      setIsLoading(false);
      return;
    }

    if (getCachedMercuryAccountsSnapshot() === null || getCachedMercuryRecipientsSnapshot() === null) {
      setIsLoading(true);
    }
    try {
      const [accountRows, recipientRows] = await Promise.all([
        adapter.listAccounts(),
        adapter.listRecipients(),
      ]);
      setAccounts(accountRows);
      setRecipients(recipientRows);
      setStatus({
        message:
          accountRows.length > 0 && recipientRows.length > 0
            ? 'Mercury accounts and recipients are ready.'
            : 'Mercury loaded, but account or recipient data is incomplete.',
        tone: accountRows.length > 0 && recipientRows.length > 0 ? 'success' : 'error',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load Mercury resources.';
      onError?.(message);
      setStatus({ message, tone: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [adapter, onError]);

  useEffect(() => {
    refreshResources().catch(() => undefined);
  }, [refreshResources]);

  async function handleSendMoney(accountId: string, input: MercurySendMoneyInput): Promise<void> {
    if (!adapter.sendMoney) {
      const message = 'Mercury send-money workflow requires a sendMoney adapter.';
      onError?.(message);
      setStatus({ message, tone: 'error' });
      return;
    }

    setIsSubmitting(true);
    try {
      const transaction = await adapter.sendMoney(accountId, input);
      const transactionId = `${transaction.id ?? 'unknown'}`;
      setStatus({
        message: `Send-money request accepted. Transaction ID: ${transactionId}.`,
        tone: 'success',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Send money request failed.';
      onError?.(message);
      setStatus({ message, tone: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <MercuryLoadingPanel
        subtitle="Initiate recipient payments through Mercury with a required idempotency key."
        message="Checking Mercury accounts and recipients..."
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
        <MercuryLogo variant="horizontal" size={280} />
        <Text style={{ color: '#d4e0d0', fontSize: 15 }}>
          Initiate recipient payments through Mercury with a required idempotency key.
        </Text>
      </View>

      <Text style={{ color: '#d4e0d0', fontSize: 14 }}>
        Accounts and recipients loaded from Mercury.
      </Text>

      <View
        style={{
          gap: 8,
          borderWidth: 1,
          borderColor: '#d4b568',
          borderRadius: 14,
          backgroundColor: '#fff8e6',
          paddingHorizontal: 12,
          paddingVertical: 10,
        }}
      >
        <Text style={{ color: '#6b4e00', fontWeight: '700' }}>Money movement guardrails</Text>
        <Text style={{ color: '#6b4e00', fontSize: 12, lineHeight: 18 }}>
          Double-check the recipient, payment method, amount, memo, and idempotency key before
          submitting. Once Mercury accepts a money movement request, it may move real funds or
          queue the transfer immediately.
        </Text>
      </View>

      <SendMoneyForm
        accounts={accounts}
        recipients={recipients}
        onSubmit={handleSendMoney}
        busy={isSubmitting}
        status={status}
      />

      {adapter.createRecipient || adapter.updateRecipient ? (
        <MercuryRecipientManager
          recipients={recipients}
          adapter={{
            createRecipient: adapter.createRecipient,
            updateRecipient: adapter.updateRecipient,
          }}
          busy={isLoading || isSubmitting}
          onRecipientsChanged={refreshResources}
          onError={onError}
        />
      ) : null}
    </View>
  );
}
