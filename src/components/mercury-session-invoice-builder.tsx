import { useEffect, useMemo, useState } from 'react';
import type { InvoiceWizardStatus } from '@mrdj/mercury-ui';
import { Time2PayMercuryInvoiceBuilder } from '@mrdj/mercury-ui';
import {
  initializeDatabase,
  listClients,
  listSessionBreaksBySessionIds,
  listSessions,
  type Client,
  type Session,
  type SessionBreak,
} from '@/database/db';
import {
  buildMercuryInvoiceDescriptionFromSessions,
  buildMercurySessionLineItems,
  computeInvoiceTotals,
  createInvoiceFromSessions,
  groupSessionBreaksBySessionId,
  type InvoiceComputation,
} from '@/services/invoice';
import {
  listMercuryAccounts,
  type MercuryAccount,
  type MercuryInvoicePayload,
} from '@/services/mercury';
import {
  SessionInvoiceSourcePanel,
  buildGroupedLineItems,
  buildWeekOptionsForClient,
  type WeekOption,
} from '@/components/session-invoice-source-panel';
import { showActionErrorAlert, showValidationAlert } from '@/services/system-alert';

type MercurySessionInvoiceBuilderProps = {
  onInvoiceCreated?: () => void;
};

function createId(prefix?: string): string {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return prefix ? `${prefix}_${suffix}` : suffix;
}

function toDayInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function MercurySessionInvoiceBuilder({
  onInvoiceCreated,
}: MercurySessionInvoiceBuilderProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [weekOptions, setWeekOptions] = useState<WeekOption[]>([]);
  const [selectedWeekKeys, setSelectedWeekKeys] = useState<string[]>([]);
  const [previewBreaksBySessionId, setPreviewBreaksBySessionId] = useState<
    Record<string, SessionBreak[]>
  >({});
  const [accounts, setAccounts] = useState<MercuryAccount[]>([]);
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [builderStatus, setBuilderStatus] = useState<InvoiceWizardStatus>({
    message: 'Loading Mercury accounts and session data...',
    tone: 'neutral',
  });

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === selectedClientId) ?? null,
    [clients, selectedClientId],
  );

  const selectedWeeks = useMemo(
    () => weekOptions.filter((week) => selectedWeekKeys.includes(week.key)),
    [weekOptions, selectedWeekKeys],
  );

  const selectedSessions = useMemo(() => {
    const uniqueSessions = new Map<string, Session>();

    for (const week of selectedWeeks) {
      for (const session of week.sessions) {
        uniqueSessions.set(session.id, session);
      }
    }

    return Array.from(uniqueSessions.values()).sort((a, b) => (a.start_time < b.start_time ? -1 : 1));
  }, [selectedWeeks]);

  const selectedSessionIds = useMemo(
    () => selectedSessions.map((session) => session.id),
    [selectedSessions],
  );

  const preview: InvoiceComputation | null = useMemo(() => {
    if (!selectedClient || selectedSessions.length === 0) {
      return null;
    }

    return computeInvoiceTotals(selectedSessions, selectedClient.hourly_rate);
  }, [selectedClient, selectedSessions]);

  const groupedLineItems = useMemo(() => buildGroupedLineItems(preview), [preview]);
  const mercuryLineItems = useMemo(
    () =>
      preview && selectedClient
        ? buildMercurySessionLineItems(preview.sessions, selectedClient.hourly_rate)
        : [],
    [preview, selectedClient],
  );
  const mercuryDescription = useMemo(
    () =>
      preview
        ? buildMercuryInvoiceDescriptionFromSessions(preview.sessions)
        : 'Invoice generated from Time2Pay sessions.',
    [preview],
  );

  const mercuryDefaults = useMemo<Partial<MercuryInvoicePayload>>(
    () => ({
      customerName: selectedClient?.name ?? '',
      customerEmail: selectedClient?.email ?? undefined,
      description: mercuryDescription,
      amount: preview?.totalAmount ?? 0,
      currency: 'USD',
      invoiceDateIso: toDayInputValue(new Date()),
      dueDateIso: toDayInputValue(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
      lineItems: mercuryLineItems,
      sendEmailOption: 'SendNow',
      achDebitEnabled: true,
      creditCardEnabled: false,
      useRealAccountNumber: false,
    }),
    [
      mercuryDescription,
      mercuryLineItems,
      preview?.totalAmount,
      selectedClient?.email,
      selectedClient?.name,
    ],
  );

  const mercuryResetKey = useMemo(
    () =>
      [
        selectedClientId ?? 'no-client',
        selectedWeekKeys.join(','),
        preview?.totalAmount ?? '0',
        selectedSessions.length,
      ].join('|'),
    [preview?.totalAmount, selectedClientId, selectedSessions.length, selectedWeekKeys],
  );

  async function refreshClients(): Promise<void> {
    const rows = await listClients();
    setClients(rows);
    setSelectedClientId((current) => {
      if (current && rows.some((row) => row.id === current)) {
        return current;
      }

      return rows[0]?.id ?? null;
    });
  }

  async function refreshWeeksForClient(clientId: string | null): Promise<void> {
    if (!clientId) {
      setWeekOptions([]);
      setSelectedWeekKeys([]);
      return;
    }

    const allSessions = await listSessions();
    const uninvoiced = allSessions.filter(
      (session) =>
        session.client_id === clientId &&
        session.invoice_id === null &&
        session.deleted_at === null &&
        session.end_time !== null,
    );

    const weeks = buildWeekOptionsForClient(uninvoiced);
    setWeekOptions(weeks);
    setSelectedWeekKeys((current) => {
      const persisted = current.filter((key) => weeks.some((week) => week.key === key));
      if (persisted.length > 0) {
        return persisted;
      }

      return weeks.map((week) => week.key);
    });
  }

  async function refreshAccounts(): Promise<void> {
    const rows = await listMercuryAccounts();
    setAccounts(rows);
    setBuilderStatus({
      message:
        rows.length > 0
          ? `Mercury connected. Loaded ${rows.length} account(s) for invoice routing.`
          : 'Mercury connected, but no destination accounts were returned.',
      tone: rows.length > 0 ? 'success' : 'error',
    });
  }

  useEffect(() => {
    Promise.all([initializeDatabase().then(() => refreshClients()), refreshAccounts()])
      .catch((error: unknown) => {
        setBuilderStatus({
          message: error instanceof Error ? error.message : 'Failed to initialize Mercury invoice builder.',
          tone: 'error',
        });
      });
  }, []);

  useEffect(() => {
    refreshWeeksForClient(selectedClientId).catch((error: unknown) => {
      setBuilderStatus({
        message: error instanceof Error ? error.message : 'Failed to load invoice weeks.',
        tone: 'error',
      });
    });
  }, [selectedClientId]);

  useEffect(() => {
    if (selectedSessionIds.length === 0) {
      setPreviewBreaksBySessionId({});
      return;
    }

    listSessionBreaksBySessionIds(selectedSessionIds)
      .then((sessionBreaks) => {
        setPreviewBreaksBySessionId(groupSessionBreaksBySessionId(sessionBreaks));
      })
      .catch((error: unknown) => {
        setBuilderStatus({
          message: error instanceof Error ? error.message : 'Failed to load session breaks.',
          tone: 'error',
        });
      });
  }, [selectedSessionIds]);

  async function handleCreateInvoice(payload: MercuryInvoicePayload): Promise<void> {
    if (!selectedClient || selectedWeeks.length === 0 || !preview) {
      const message = 'Select a client and at least one week with uninvoiced sessions.';
      showValidationAlert(message);
      setBuilderStatus({ message, tone: 'error' });
      return;
    }

    if (selectedSessions.length === 0) {
      const message = 'No sessions available for the selected weeks.';
      showValidationAlert(message);
      setBuilderStatus({ message, tone: 'error' });
      return;
    }

    if (!payload.customerEmail?.trim()) {
      const message = 'Customer email is required to create the Mercury invoice.';
      showValidationAlert(message);
      setBuilderStatus({ message, tone: 'error' });
      return;
    }

    setIsCreatingInvoice(true);
    setBuilderStatus({
      message: 'Creating the local invoice and Mercury AR invoice...',
      tone: 'neutral',
    });

    try {
      const invoiceId = createId('invoice');
      const result = await createInvoiceFromSessions({
        invoiceId,
        clientId: selectedClient.id,
        sessionIds: selectedSessionIds,
        hourlyRate: selectedClient.hourly_rate,
        mercury: {
          enabled: true,
          customerName: payload.customerName,
          customerEmail: payload.customerEmail,
          description: payload.description,
          dueDateIso: payload.dueDateIso,
          invoiceDateIso: payload.invoiceDateIso,
          destinationAccountId: payload.destinationAccountId,
          amount: payload.amount,
          currency: payload.currency,
          lineItems: payload.lineItems,
          sendEmailOption: payload.sendEmailOption,
          achDebitEnabled: payload.achDebitEnabled,
          creditCardEnabled: payload.creditCardEnabled,
          useRealAccountNumber: payload.useRealAccountNumber,
          ccEmails: payload.ccEmails,
        },
      });

      const hostedUrl = result.mercuryInvoice?.hosted_url?.trim();
      const paymentLabel = hostedUrl
        ? ' Open it from Saved Invoices with the "Open Mercury Invoice" button.'
        : '';
      const warningLabel = result.mercuryWarning ? ` ${result.mercuryWarning}` : '';
      setBuilderStatus({
        message: `Invoice ${invoiceId} created for ${selectedClient.name}. Local total remains $${result.totalAmount.toFixed(2)}.${paymentLabel}${warningLabel}`,
        tone: result.mercuryWarning ? 'error' : 'success',
      });

      await refreshWeeksForClient(selectedClient.id);
      onInvoiceCreated?.();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create Mercury invoice.';
      showActionErrorAlert(message);
      setBuilderStatus({ message, tone: 'error' });
    } finally {
      setIsCreatingInvoice(false);
    }
  }

  return (
    <Time2PayMercuryInvoiceBuilder
      accounts={accounts}
      defaults={mercuryDefaults}
      resetKey={mercuryResetKey}
      onSubmit={handleCreateInvoice}
      busy={isCreatingInvoice}
      status={builderStatus}
      sourceChildren={
        <SessionInvoiceSourcePanel
          clients={clients}
          selectedClientId={selectedClientId}
          onSelectClient={setSelectedClientId}
          weekOptions={weekOptions}
          selectedWeekKeys={selectedWeekKeys}
          onToggleWeek={(weekKey) =>
            setSelectedWeekKeys((current) =>
              current.includes(weekKey)
                ? current.filter((existing) => existing !== weekKey)
                : [...current, weekKey],
            )
          }
          selectedClient={selectedClient}
          preview={preview}
          groupedLineItems={groupedLineItems}
          previewBreaksBySessionId={previewBreaksBySessionId}
        />
      }
    />
  );
}
