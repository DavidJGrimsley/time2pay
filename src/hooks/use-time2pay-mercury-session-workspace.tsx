import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type {
  InvoiceWizardStatus,
  MercurySessionInvoiceAdapter,
} from '@mr.dj2u/mercury-ui';
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
  buildMercuryServicePeriodFromSessions,
  buildMercurySessionLineItems,
  computeInvoiceTotals,
  createInvoiceFromSessions,
  groupSessionBreaksBySessionId,
  type InvoiceComputation,
} from '@/services/invoice';
import {
  SessionInvoiceSourcePanel,
  buildGroupedLineItems,
  buildWeekOptionsForClient,
  type WeekOption,
} from '@/components/session-invoice-source-panel';
import type { MercuryInvoicePayload } from '@/services/mercury';
import { showActionErrorAlert, showValidationAlert } from '@/services/system-alert';

type UseTime2PayMercurySessionWorkspaceOptions = {
  onInvoiceCreated?: () => void;
};

function createId(prefix?: string): string {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return prefix ? `${prefix}_${suffix}` : suffix;
}

function toDayInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function useTime2PayMercurySessionWorkspace({
  onInvoiceCreated,
}: UseTime2PayMercurySessionWorkspaceOptions): MercurySessionInvoiceAdapter {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [weekOptions, setWeekOptions] = useState<WeekOption[]>([]);
  const [selectedWeekKeys, setSelectedWeekKeys] = useState<string[]>([]);
  const [previewBreaksBySessionId, setPreviewBreaksBySessionId] = useState<
    Record<string, SessionBreak[]>
  >({});
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [hasAcknowledgedBeta, setHasAcknowledgedBeta] = useState(false);
  const [builderStatus, setBuilderStatus] = useState<InvoiceWizardStatus>({
    message: 'Loading Time2Pay session data...',
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
  const mercuryServicePeriod = useMemo(
    () =>
      preview
        ? buildMercuryServicePeriodFromSessions(preview.sessions)
        : { startDate: undefined, endDate: undefined },
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
      servicePeriodStartDate: mercuryServicePeriod.startDate,
      servicePeriodEndDate: mercuryServicePeriod.endDate,
      lineItems: mercuryLineItems,
      sendEmailOption: 'SendNow',
      achDebitEnabled: true,
      creditCardEnabled: false,
      useRealAccountNumber: false,
    }),
    [
      mercuryDescription,
      mercuryLineItems,
      mercuryServicePeriod.endDate,
      mercuryServicePeriod.startDate,
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

  useEffect(() => {
    initializeDatabase()
      .then(() => refreshClients())
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
    if (!hasAcknowledgedBeta) {
      const message =
        'Review the Mercury AR beta warning and confirm before creating a Mercury invoice.';
      showValidationAlert(message);
      setBuilderStatus({ message, tone: 'error' });
      return;
    }

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
          servicePeriodStartDate: payload.servicePeriodStartDate,
          servicePeriodEndDate: payload.servicePeriodEndDate,
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

  return {
    defaults: mercuryDefaults,
    resetKey: mercuryResetKey,
    busy: isCreatingInvoice,
    status: builderStatus,
    footer: (
      <View
        style={{
          gap: 10,
          borderWidth: 1,
          borderColor: '#d4b568',
          borderRadius: 14,
          backgroundColor: '#fff8e6',
          paddingHorizontal: 12,
          paddingVertical: 10,
        }}
      >
        <Text style={{ color: '#6b4e00', fontWeight: '700' }}>Mercury AR beta guardrails</Text>
        <Text style={{ color: '#6b4e00', fontSize: 12, lineHeight: 18 }}>
          Mercury invoicing is still beta. Review destination account, service period, line items, and send-email option before submitting. A local Time2Pay invoice may still be created even if Mercury sync fails.
        </Text>
        <Pressable
          onPress={() => setHasAcknowledgedBeta((value) => !value)}
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 8,
          }}
        >
          <View
            style={{
              width: 18,
              height: 18,
              borderRadius: 4,
              borderWidth: 1,
              borderColor: '#6b4e00',
              backgroundColor: hasAcknowledgedBeta ? '#6b4e00' : '#ffffff',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {hasAcknowledgedBeta ? (
              <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: '800' }}>v</Text>
            ) : null}
          </View>
          <Text
            style={{
              color: '#6b4e00',
              fontSize: 12,
              fontWeight: '700',
              flex: 1,
              lineHeight: 18,
            }}
          >
            I understand the Mercury invoice flow is beta and requires careful review.
          </Text>
        </Pressable>
      </View>
    ),
    renderSourcePanel: () => (
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
    ),
    submitInvoice: handleCreateInvoice,
  };
}
