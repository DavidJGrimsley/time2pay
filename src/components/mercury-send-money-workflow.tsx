import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import type {
  MercuryAccount,
  MercuryRecipient,
  MercurySendMoneyInput,
} from '@/services/mercury';
import {
  listMercuryAccounts,
  listMercuryRecipients,
  sendMercuryMoney,
} from '@/services/mercury';
import {
  MercuryLogo,
  SendMoneyForm,
  type MercuryStatusTone,
} from '@mrdj/mercury-ui';
import { MercuryRecipientManager } from '@/components/mercury-recipient-manager';
import { showActionErrorAlert } from '@/services/system-alert';

type WorkflowStatus = {
  message: string;
  tone: MercuryStatusTone;
};

export function MercurySendMoneyWorkflow() {
  const [accounts, setAccounts] = useState<MercuryAccount[]>([]);
  const [recipients, setRecipients] = useState<MercuryRecipient[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<WorkflowStatus>({
    message: 'Load Mercury accounts and recipients to prepare a payment.',
    tone: 'neutral',
  });

  async function refreshResources(): Promise<void> {
    setIsLoading(true);
    try {
      const [accountRows, recipientRows] = await Promise.all([
        listMercuryAccounts(),
        listMercuryRecipients(),
      ]);
      setAccounts(accountRows);
      setRecipients(recipientRows);
      setStatus({
        message: `Loaded ${accountRows.length} account(s) and ${recipientRows.length} recipient(s).`,
        tone: accountRows.length > 0 && recipientRows.length > 0 ? 'success' : 'error',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load Mercury resources.';
      setStatus({ message, tone: 'error' });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refreshResources().catch(() => undefined);
  }, []);

  async function handleSendMoney(
    accountId: string,
    input: MercurySendMoneyInput,
  ): Promise<void> {
    setIsSubmitting(true);
    try {
      const transaction = await sendMercuryMoney(accountId, input);
      const transactionId = `${transaction.id ?? 'unknown'}`;
      setStatus({
        message: `Send-money request accepted. Transaction ID: ${transactionId}.`,
        tone: 'success',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Send money request failed.';
      showActionErrorAlert(message);
      setStatus({ message, tone: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View
      className="gap-4 rounded-2xl border p-5"
      style={{ borderColor: '#314233', backgroundColor: '#0f1711' }}
    >
      <View className="gap-2">
        <MercuryLogo variant="horizontal" size={280} />
        <Text style={{ color: '#d4e0d0', fontSize: 15 }}>
          Initiate recipient payments through Mercury with a required idempotency key.
        </Text>
      </View>

      <View>
        <Text style={{ color: '#d4e0d0', fontSize: 14 }}>
          {isLoading
            ? 'Loading accounts and recipients from Mercury...'
            : 'Accounts and recipients loaded from Mercury.'}
        </Text>
      </View>

      <SendMoneyForm
        accounts={accounts}
        recipients={recipients}
        onSubmit={handleSendMoney}
        busy={isSubmitting}
        status={status}
      />
      <MercuryRecipientManager
        recipients={recipients}
        busy={isLoading || isSubmitting}
        onRecipientsChanged={refreshResources}
      />
    </View>
  );
}
