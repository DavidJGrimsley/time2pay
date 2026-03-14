import * as Linking from 'expo-linking';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  getUserProfile,
  initializeDatabase,
  listInvoices,
  listSessionBreaksBySessionIds,
  listSessionsByInvoiceId,
  type InvoiceWithClient,
} from '@/database/db';
import {
  computeInvoiceTotals,
  exportInvoicePdf,
  groupSessionBreaksBySessionId,
  type ExportableInvoice,
  type InvoiceComputation,
} from '@/services/invoice';
import { InlineNotice, type NoticeTone } from '@/components/inline-notice';
import { showActionErrorAlert, showValidationAlert } from '@/services/system-alert';

type InvoiceHistoryProps = {
  refreshKey: number;
};

type StatusNotice = {
  message: string;
  tone: NoticeTone;
};

const FOOTER_LOGO_URL = '/images/time2payLogo.png';

function formatMoney(value: number): string {
  return value.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

async function triggerPdfDownload(filename: string, bytes: Uint8Array): Promise<void> {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    throw new Error('PDF download is currently supported on web in this build.');
  }

  const arrayBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(objectUrl);
}

async function buildExportableInvoice(invoice: InvoiceWithClient): Promise<{
  exportable: ExportableInvoice;
  totals: InvoiceComputation;
}> {
  const sessions = await listSessionsByInvoiceId(invoice.id);
  const sessionBreaks = await listSessionBreaksBySessionIds(sessions.map((session) => session.id));
  const userProfile = await getUserProfile();
  const hourlyRate = invoice.client_hourly_rate ?? 0;
  const totals = computeInvoiceTotals(sessions, hourlyRate);

  return {
    exportable: {
      invoiceId: invoice.id,
      issuedAtIso: invoice.created_at,
      hourlyRate,
      sessions: totals.sessions,
      breaksBySessionId: groupSessionBreaksBySessionId(sessionBreaks),
      totalHours: totals.totalHours,
      totalAmount: totals.totalAmount,
      paymentLink: invoice.payment_link ?? null,
      sender: {
        companyName: userProfile.company_name,
        logoUrl: userProfile.logo_url,
        fullName: userProfile.full_name,
        phone: userProfile.phone,
        email: userProfile.email,
      },
      recipient: {
        companyName: invoice.client_name ?? invoice.client_id,
        phone: invoice.client_phone ?? null,
        email: invoice.client_email ?? null,
      },
      footerLogoUrl: FOOTER_LOGO_URL,
    },
    totals,
  };
}

export function InvoiceHistory({ refreshKey }: InvoiceHistoryProps) {
  const [invoices, setInvoices] = useState<InvoiceWithClient[]>([]);
  const [status, setStatus] = useState<StatusNotice>({
    message: 'Loading saved invoices...',
    tone: 'neutral',
  });
  const [activeInvoiceId, setActiveInvoiceId] = useState<string | null>(null);

  const loadInvoices = useCallback(async () => {
    const rows = await listInvoices();
    setInvoices(rows);
    setStatus({
      message: rows.length > 0 ? `Loaded ${rows.length} saved invoice(s).` : 'No saved invoices yet.',
      tone: 'neutral',
    });
  }, []);

  useEffect(() => {
    initializeDatabase()
      .then(() => loadInvoices())
      .catch((error: unknown) => {
        setStatus({
          message: error instanceof Error ? error.message : 'Failed to load saved invoices.',
          tone: 'error',
        });
      });
  }, [loadInvoices, refreshKey]);

  async function handleDownloadPdf(invoice: InvoiceWithClient): Promise<void> {
    setActiveInvoiceId(invoice.id);
    setStatus({ message: `Generating Time2Pay PDF for ${invoice.id}...`, tone: 'neutral' });
    try {
      const { exportable } = await buildExportableInvoice(invoice);
      const bytes = await exportInvoicePdf(exportable);
      await triggerPdfDownload(`invoice-${invoice.id}.pdf`, bytes);
      setStatus({ message: `Downloaded Time2Pay PDF for ${invoice.id}.`, tone: 'success' });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to generate the Time2Pay invoice PDF.';
      showActionErrorAlert(message);
      setStatus({ message, tone: 'error' });
    } finally {
      setActiveInvoiceId(null);
    }
  }

  async function handleOpenPaymentLink(invoice: InvoiceWithClient): Promise<void> {
    const paymentLink = invoice.payment_link?.trim();
    if (!paymentLink) {
      return;
    }

    setActiveInvoiceId(invoice.id);
    setStatus({
      message: invoice.mercury_invoice_id
        ? `Opening hosted Mercury invoice ${invoice.id}...`
        : `Opening payment link for ${invoice.id}...`,
      tone: 'neutral',
    });

    try {
      await Linking.openURL(paymentLink);
      setStatus({
        message: invoice.mercury_invoice_id
          ? `Opened hosted Mercury invoice ${invoice.id}.`
          : `Opened payment link for ${invoice.id}.`,
        tone: 'success',
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to open the invoice payment link.';
      showActionErrorAlert(message);
      setStatus({ message, tone: 'error' });
    } finally {
      setActiveInvoiceId(null);
    }
  }

  async function handleComposeEmail(invoice: InvoiceWithClient): Promise<void> {
    setActiveInvoiceId(invoice.id);
    setStatus({ message: `Preparing email draft for ${invoice.id}...`, tone: 'neutral' });

    try {
      const { totals } = await buildExportableInvoice(invoice);
      const recipient = (invoice.client_email ?? '').trim();
      if (!recipient) {
        const message = `Invoice ${invoice.id} is ready. Add a client accounting email to open a prefilled draft.`;
        showValidationAlert(message);
        setStatus({ message, tone: 'error' });
        return;
      }

      const subject = `Invoice ${invoice.id} - ${invoice.client_name ?? 'Client'}`;
      const body = [
        `Hi,`,
        ``,
        `Please find invoice ${invoice.id}.`,
        `Issue date: ${new Date(invoice.created_at).toLocaleDateString()}`,
        `Total hours: ${totals.totalHours.toFixed(2)}`,
        `Total amount: ${formatMoney(totals.totalAmount)}`,
        ``,
        `Thanks,`,
      ].join('\n');

      const mailtoUrl = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      await Linking.openURL(mailtoUrl);
      setStatus({
        message: `Opened email draft for ${invoice.id}. Attach the exported PDF before sending.`,
        tone: 'success',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to compose email draft.';
      showActionErrorAlert(message);
      setStatus({ message, tone: 'error' });
    } finally {
      setActiveInvoiceId(null);
    }
  }

  return (
    <View className="gap-3 rounded-xl bg-card p-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-xl font-bold text-heading">Saved Invoices</Text>
        <Pressable className="rounded-md border border-border px-3 py-1.5" onPress={() => loadInvoices()}>
          <Text className="font-semibold text-heading">Refresh</Text>
        </Pressable>
      </View>

      {invoices.length === 0 ? (
        <Text className="text-sm text-muted">Create your first invoice to see it here.</Text>
      ) : null}

      {invoices.map((invoice) => {
        const isBusy = activeInvoiceId === invoice.id;
        return (
          <View key={invoice.id} className="gap-2 rounded-md border border-border bg-background p-3">
            <Text className="font-semibold text-heading">
              {invoice.client_name ?? invoice.client_id} - {formatMoney(invoice.total)}
            </Text>
            <Text className="text-sm text-muted">Invoice ID: {invoice.id}</Text>
            <Text className="text-sm text-muted">Created: {formatDateTime(invoice.created_at)}</Text>
            <Text className="text-sm text-muted">Status: {invoice.status}</Text>
            {invoice.mercury_invoice_id ? (
              <Text className="text-sm text-muted">
                Mercury invoice ID: {invoice.mercury_invoice_id}
              </Text>
            ) : null}
            {invoice.payment_link ? (
              <Text className="text-sm text-muted">Payment link: {invoice.payment_link}</Text>
            ) : null}

            <View className="flex-row gap-2">
              <Pressable
                className="rounded-md bg-secondary px-3 py-2"
                onPress={() => handleDownloadPdf(invoice)}
                disabled={isBusy}
              >
                <Text className="font-semibold text-white">
                  {isBusy ? 'Working...' : 'Download Time2Pay PDF'}
                </Text>
              </Pressable>
              {invoice.payment_link ? (
                <Pressable
                  className="rounded-md border border-border px-3 py-2"
                  onPress={() => handleOpenPaymentLink(invoice)}
                  disabled={isBusy}
                >
                  <Text className="font-semibold text-heading">
                    {isBusy
                      ? 'Working...'
                      : invoice.mercury_invoice_id
                        ? 'Open Mercury Invoice'
                        : 'Open Payment Link'}
                  </Text>
                </Pressable>
              ) : null}
              <Pressable
                className="rounded-md border border-border px-3 py-2"
                onPress={() => handleComposeEmail(invoice)}
                disabled={isBusy}
              >
                <Text className="font-semibold text-heading">
                  {isBusy ? 'Working...' : 'Compose Email'}
                </Text>
              </Pressable>
            </View>
          </View>
        );
      })}

      <InlineNotice tone={status.tone} message={status.message} />
    </View>
  );
}
