import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
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
  computeInvoiceTotals,
  createInvoiceFromSessions,
  deriveSessionTimelineRows,
  groupSessionBreaksBySessionId,
  groupInvoiceLineItemsByTask,
  type InvoiceComputation,
} from '@/services/invoice';
import { testMercuryConnection } from '@/services/mercury';

type WeekOption = {
  key: string;
  label: string;
  startIso: string;
  endIso: string;
  sessions: Session[];
};

function createId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function startOfWeekMonday(date: Date): Date {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() + diff);
  return copy;
}

function endOfWeekSunday(startMonday: Date): Date {
  const copy = new Date(startMonday);
  copy.setDate(copy.getDate() + 6);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function isoDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildWeekOptionsForClient(sessions: Session[]): WeekOption[] {
  const map = new Map<string, WeekOption>();

  for (const session of sessions) {
    const startDate = new Date(session.start_time);
    const monday = startOfWeekMonday(startDate);
    const sunday = endOfWeekSunday(monday);
    const key = isoDateOnly(monday);

    const existing = map.get(key);
    if (existing) {
      existing.sessions.push(session);
      continue;
    }

    map.set(key, {
      key,
      label: `${monday.toLocaleDateString()} - ${sunday.toLocaleDateString()}`,
      startIso: monday.toISOString(),
      endIso: new Date(monday.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      sessions: [session],
    });
  }

  return Array.from(map.values()).sort((a, b) => (a.startIso < b.startIso ? 1 : -1));
}

type InvoiceBuilderProps = {
  onInvoiceCreated?: () => void;
};

export function InvoiceBuilder({ onInvoiceCreated }: InvoiceBuilderProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [weekOptions, setWeekOptions] = useState<WeekOption[]>([]);
  const [selectedWeekKey, setSelectedWeekKey] = useState<string | null>(null);
  const [invoiceStatus, setInvoiceStatus] = useState<string>('No invoice created yet');
  const [mercuryStatus, setMercuryStatus] = useState<string>('Not checked yet');
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [syncToMercury, setSyncToMercury] = useState(true);
  const [previewBreaksBySessionId, setPreviewBreaksBySessionId] = useState<Record<string, SessionBreak[]>>(
    {},
  );

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === selectedClientId) ?? null,
    [clients, selectedClientId],
  );

  const selectedWeek = useMemo(
    () => weekOptions.find((week) => week.key === selectedWeekKey) ?? null,
    [weekOptions, selectedWeekKey],
  );

  const preview: InvoiceComputation | null = useMemo(() => {
    if (!selectedClient || !selectedWeek) {
      return null;
    }

    return computeInvoiceTotals(selectedWeek.sessions, selectedClient.hourly_rate);
  }, [selectedClient, selectedWeek]);

  const groupedLineItems = useMemo(
    () => (preview ? groupInvoiceLineItemsByTask(preview.sessions) : []),
    [preview],
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
      setSelectedWeekKey(null);
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
    setSelectedWeekKey((current) => {
      if (current && weeks.some((week) => week.key === current)) {
        return current;
      }
      return weeks[0]?.key ?? null;
    });
  }

  useEffect(() => {
    initializeDatabase()
      .then(() => refreshClients())
      .catch((error: unknown) => {
      setInvoiceStatus(error instanceof Error ? error.message : 'Failed to load clients');
      });
  }, []);

  useEffect(() => {
    refreshWeeksForClient(selectedClientId).catch((error: unknown) => {
      setInvoiceStatus(error instanceof Error ? error.message : 'Failed to load invoice weeks');
    });
  }, [selectedClientId]);

  useEffect(() => {
    if (!selectedWeek) {
      setPreviewBreaksBySessionId({});
      return;
    }

    const sessionIds = selectedWeek.sessions.map((session) => session.id);
    listSessionBreaksBySessionIds(sessionIds)
      .then((sessionBreaks) => {
        setPreviewBreaksBySessionId(groupSessionBreaksBySessionId(sessionBreaks));
      })
      .catch((error: unknown) => {
        setInvoiceStatus(error instanceof Error ? error.message : 'Failed to load session breaks');
      });
  }, [selectedWeek]);

  async function handleMercuryCheck(): Promise<void> {
    setMercuryStatus('Checking Mercury API connection...');
    try {
      const result = await testMercuryConnection();
      setMercuryStatus(`Mercury connected (${result.environment}).`);
    } catch (error: unknown) {
      setMercuryStatus(error instanceof Error ? error.message : 'Mercury connection failed');
    }
  }

  async function handleCreateInvoice(): Promise<void> {
    if (!selectedClient || !selectedWeek || !preview) {
      setInvoiceStatus('Select a client and week with uninvoiced sessions.');
      return;
    }

    if (selectedWeek.sessions.length === 0) {
      setInvoiceStatus('No sessions available for the selected week.');
      return;
    }

    if (syncToMercury && !selectedClient.email) {
      setInvoiceStatus(
        'Add an accounting email to this client before creating a Mercury payable invoice.',
      );
      return;
    }

    setIsCreatingInvoice(true);
    setInvoiceStatus('Creating invoice...');

    try {
      const invoiceId = createId('invoice');
      const result = await createInvoiceFromSessions({
        invoiceId,
        clientId: selectedClient.id,
        sessionIds: selectedWeek.sessions.map((session) => session.id),
        hourlyRate: selectedClient.hourly_rate,
        mercury: syncToMercury
          ? {
              enabled: true,
              customerName: selectedClient.name,
              customerEmail: selectedClient.email ?? undefined,
              description: `Weekly invoice for ${selectedWeek.label}`,
            }
          : undefined,
      });

      const paymentLabel = result.mercuryInvoice?.hosted_url
        ? ` Payment link: ${result.mercuryInvoice.hosted_url}`
        : '';
      const warningLabel = result.mercuryWarning ? ` ${result.mercuryWarning}` : '';
      setInvoiceStatus(
        `Invoice ${invoiceId} created for ${selectedClient.name}. Total $${result.totalAmount.toFixed(2)}.${paymentLabel}${warningLabel}`,
      );

      await refreshWeeksForClient(selectedClient.id);
      onInvoiceCreated?.();
    } catch (error: unknown) {
      setInvoiceStatus(error instanceof Error ? error.message : 'Failed to create invoice');
    } finally {
      setIsCreatingInvoice(false);
    }
  }

  return (
    <View className="gap-3 rounded-xl bg-card p-4">
      <Text className="text-xl font-bold text-heading">Invoice Builder</Text>
      <Text className="text-muted">
        Create invoices by client and week (Monday through Sunday). Line items are grouped by task
        with each session listed underneath.
      </Text>

      <View className="gap-2">
        <Text className="text-xs uppercase tracking-wide text-muted">Client</Text>
        <View className="flex-row flex-wrap gap-2">
          {clients.map((client) => {
            const active = client.id === selectedClientId;
            return (
              <Pressable
                key={client.id}
                className={active ? 'rounded-full bg-primary px-3 py-1.5' : 'rounded-full bg-card px-3 py-1.5'}
                onPress={() => setSelectedClientId(client.id)}
              >
                <Text className={active ? 'font-semibold text-heading' : 'font-semibold text-muted'}>
                  {client.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View className="gap-2">
        <Text className="text-xs uppercase tracking-wide text-muted">Week (Mon-Sun)</Text>
        <View className="flex-row flex-wrap gap-2">
          {weekOptions.map((week) => {
            const active = week.key === selectedWeekKey;
            return (
              <Pressable
                key={week.key}
                className={active ? 'rounded-full bg-secondary px-3 py-1.5' : 'rounded-full bg-primary px-3 py-1.5'}
                onPress={() => setSelectedWeekKey(week.key)}
              >
                <Text className={active ? 'font-semibold text-white' : 'font-semibold text-heading'}>
                  {week.label}
                </Text>
              </Pressable>
            );
          })}
          {weekOptions.length === 0 ? (
            <Text className="text-sm text-muted">No uninvoiced sessions for this client yet.</Text>
          ) : null}
        </View>
      </View>

      <Pressable
        className="rounded-md border border-border px-4 py-2"
        onPress={() => setSyncToMercury((current) => !current)}
      >
        <Text className="font-semibold text-heading">
          Mercury payable invoice: {syncToMercury ? 'On' : 'Off'}
        </Text>
      </Pressable>

      <Pressable
        className="rounded-md bg-secondary px-4 py-2"
        onPress={handleCreateInvoice}
        disabled={isCreatingInvoice || !selectedClient || !selectedWeek}
      >
        <Text className="text-center font-semibold text-white">
          {isCreatingInvoice ? 'Creating...' : 'Create Invoice'}
        </Text>
      </Pressable>

      <View className="gap-2 rounded-md border border-border bg-background p-3">
        <Text className="font-semibold text-heading">Invoice Preview Line Items</Text>
        {!preview ? <Text className="text-sm text-muted">Select a client and week to preview.</Text> : null}
        {groupedLineItems.map((group) => (
          <View key={group.taskLabel} className="gap-1">
            <Text className="font-semibold text-heading">
              {group.taskLabel} - {group.totalHours.toFixed(2)}h - ${group.totalAmount.toFixed(2)}
            </Text>
            <View className="ml-4 mt-1 overflow-hidden rounded-md border border-border bg-card">
              <View className="flex-row border-b border-border bg-background px-2 py-1">
                <Text style={{ width: '40%' }} className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Start
                </Text>
                <Text style={{ width: '40%' }} className="text-xs font-semibold uppercase tracking-wide text-muted">
                  End
                </Text>
                <Text
                  style={{ width: '10%' }}
                  className="text-right text-xs font-semibold uppercase tracking-wide text-muted"
                >
                  Hrs
                </Text>
                <Text
                  style={{ width: '10%' }}
                  className="text-right text-xs font-semibold uppercase tracking-wide text-muted"
                >
                  $
                </Text>
              </View>
              {group.sessions.map((session) => (
                <View key={session.id} className="border-b border-border/60 px-2 py-1.5">
                  {deriveSessionTimelineRows({
                    session,
                    breaks: previewBreaksBySessionId[session.id] ?? [],
                    hourlyRate: selectedClient?.hourly_rate ?? 0,
                  }).map((row) => (
                    <View key={row.id} className="flex-row py-0.5">
                      <Text style={{ width: '40%' }} className="text-xs text-muted">
                        {new Date(row.start_time).toLocaleString()}
                      </Text>
                      <Text style={{ width: '40%' }} className="text-xs text-muted">
                        {new Date(row.end_time).toLocaleString()}
                      </Text>
                      <Text
                        style={{ width: '10%' }}
                        className={
                          row.isBreak
                            ? 'text-right text-xs font-semibold text-secondary'
                            : 'text-right text-xs text-muted'
                        }
                      >
                        {row.isBreak ? 'Break' : row.hours.toFixed(2)}
                      </Text>
                      <Text style={{ width: '10%' }} className="text-right text-xs text-muted">
                        {row.isBreak ? '-' : row.amount.toFixed(2)}
                      </Text>
                    </View>
                  ))}
                  {session.notes ? <Text className="pt-0.5 text-xs text-muted">Note: {session.notes}</Text> : null}
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>

      <Pressable className="rounded-md border border-border px-4 py-2" onPress={handleMercuryCheck}>
        <Text className="text-center font-semibold text-heading">Test Mercury Connection</Text>
      </Pressable>
      <Text className="text-sm text-muted">{mercuryStatus}</Text>
      <Text className="text-sm text-muted">{invoiceStatus}</Text>
    </View>
  );
}
