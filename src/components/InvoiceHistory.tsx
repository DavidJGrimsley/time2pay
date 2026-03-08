import * as Linking from 'expo-linking';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
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

type InvoiceHistoryProps = {
  refreshKey: number;
};

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
  const hourlyRate = invoice.client_hourly_rate ?? 0;
  const totals = computeInvoiceTotals(sessions, hourlyRate);

  return {
    exportable: {
      invoiceId: invoice.id,
      clientLabel: invoice.client_name ?? invoice.client_id,
      issuedAtIso: invoice.created_at,
      hourlyRate,
      sessions: totals.sessions,
      breaksBySessionId: groupSessionBreaksBySessionId(sessionBreaks),
      totalHours: totals.totalHours,
      totalAmount: totals.totalAmount,
      paymentLink: invoice.payment_link ?? null,
    },
    totals,
  };
}

export function InvoiceHistory({ refreshKey }: InvoiceHistoryProps) {
  const [invoices, setInvoices] = useState<InvoiceWithClient[]>([]);
  const [status, setStatus] = useState('Loading saved invoices...');
  const [activeInvoiceId, setActiveInvoiceId] = useState<string | null>(null);

  const loadInvoices = useCallback(async () => {
    const rows = await listInvoices();
    setInvoices(rows);
    setStatus(rows.length > 0 ? `Loaded ${rows.length} saved invoice(s).` : 'No saved invoices yet.');
  }, []);

  useEffect(() => {
    initializeDatabase()
      .then(() => loadInvoices())
      .catch((error: unknown) => {
        setStatus(error instanceof Error ? error.message : 'Failed to load saved invoices.');
      });
  }, [loadInvoices, refreshKey]);

  async function handleDownloadPdf(invoice: InvoiceWithClient): Promise<void> {
    setActiveInvoiceId(invoice.id);
    setStatus(`Generating PDF for ${invoice.id}...`);
    try {
      const { exportable } = await buildExportableInvoice(invoice);
      const bytes = await exportInvoicePdf(exportable);
      await triggerPdfDownload(`invoice-${invoice.id}.pdf`, bytes);
      setStatus(`Downloaded PDF for ${invoice.id}.`);
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : 'Failed to generate invoice PDF.');
    } finally {
      setActiveInvoiceId(null);
    }
  }

  async function handleComposeEmail(invoice: InvoiceWithClient): Promise<void> {
    setActiveInvoiceId(invoice.id);
    setStatus(`Preparing email draft for ${invoice.id}...`);

    try {
      const { totals } = await buildExportableInvoice(invoice);
      const recipient = (invoice.client_email ?? '').trim();
      if (!recipient) {
        setStatus(
          `Invoice ${invoice.id} is ready. Add a client accounting email to open a prefilled draft.`,
        );
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
      setStatus(`Opened email draft for ${invoice.id}. Attach the exported PDF before sending.`);
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : 'Failed to compose email draft.');
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
                  {isBusy ? 'Working...' : 'Download PDF'}
                </Text>
              </Pressable>
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

      <Text className="text-sm text-muted">{status}</Text>
    </View>
  );
}
