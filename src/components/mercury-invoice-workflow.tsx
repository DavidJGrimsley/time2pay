import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import type { MercuryAccount, MercuryInvoicePayload } from '@/services/mercury';
import {
  createMercuryInvoice,
  listMercuryAccounts,
} from '@/services/mercury';
import {
  MercuryLogo,
  QuickInvoiceWizard,
  type MercuryStatusTone,
} from '@mrdj/mercury-ui';
import { showActionErrorAlert } from '@/services/system-alert';

type MercuryInvoiceWorkflowProps = {
  onInvoiceCreated?: () => void;
};

type WorkflowStatus = {
  message: string;
  tone: MercuryStatusTone;
};

export function MercuryInvoiceWorkflow({ onInvoiceCreated }: MercuryInvoiceWorkflowProps) {
  const [accounts, setAccounts] = useState<MercuryAccount[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<WorkflowStatus>({
    message: 'Load accounts to start creating Mercury invoices.',
    tone: 'neutral',
  });

  async function refreshAccounts(): Promise<void> {
    setIsLoadingAccounts(true);
    try {
      const rows = await listMercuryAccounts();
      setAccounts(rows);
      setStatus({
        message: rows.length > 0
          ? `Loaded ${rows.length} account(s).`
          : 'No Mercury accounts found.',
        tone: rows.length > 0 ? 'success' : 'error',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load Mercury accounts.';
      setStatus({ message, tone: 'error' });
    } finally {
      setIsLoadingAccounts(false);
    }
  }

  useEffect(() => {
    refreshAccounts().catch(() => undefined);
  }, []);

  async function handleSubmit(payload: MercuryInvoicePayload): Promise<void> {
    setIsSubmitting(true);
    try {
      const invoice = await createMercuryInvoice(payload);
      const hostedUrl = `${invoice.hosted_url ?? invoice.hostedUrl ?? ''}`.trim();
      setStatus({
        message: hostedUrl
          ? `Invoice ${invoice.id} created. Hosted URL: ${hostedUrl}`
          : `Invoice ${invoice.id} created successfully.`,
        tone: 'success',
      });
      onInvoiceCreated?.();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create Mercury invoice.';
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
          Direct invoice creation in Mercury AR, using the new workspace SDK.
        </Text>
      </View>

      <View>
        <Text style={{ color: '#d4e0d0', fontSize: 14 }}>
          {isLoadingAccounts ? 'Loading accounts from Mercury...' : 'Accounts ready for invoice routing.'}
        </Text>
      </View>

      <QuickInvoiceWizard
        accounts={accounts}
        onSubmit={handleSubmit}
        busy={isSubmitting}
        status={status}
      />
    </View>
  );
}
