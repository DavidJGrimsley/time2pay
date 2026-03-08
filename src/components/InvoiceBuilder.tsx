import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, useColorScheme, View } from 'react-native';
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
  groupInvoiceLineItemsByProject,
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

function createId(prefix?: string): string {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return prefix ? `${prefix}_${suffix}` : suffix;
}

function WeekCheckIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 12, height: 12, position: 'relative' }}>
      <View
        style={{
          position: 'absolute',
          left: 1,
          top: 6,
          width: 4,
          height: 2,
          borderRadius: 1,
          backgroundColor: color,
          transform: [{ rotate: '45deg' }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: 3,
          top: 5,
          width: 8,
          height: 2,
          borderRadius: 1,
          backgroundColor: color,
          transform: [{ rotate: '-45deg' }],
        }}
      />
    </View>
  );
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
  const scheme = useColorScheme();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [weekOptions, setWeekOptions] = useState<WeekOption[]>([]);
  const [selectedWeekKeys, setSelectedWeekKeys] = useState<string[]>([]);
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

  const selectedWeeksLabel = useMemo(() => {
    if (selectedWeeks.length === 0) {
      return null;
    }

    if (selectedWeeks.length === 1) {
      return selectedWeeks[0].label;
    }

    return `${selectedWeeks.length} selected weeks`;
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

  const groupedLineItems = useMemo(
    () => (preview ? groupInvoiceLineItemsByProject(preview.sessions) : []),
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
      setInvoiceStatus(error instanceof Error ? error.message : 'Failed to load clients');
      });
  }, []);

  useEffect(() => {
    refreshWeeksForClient(selectedClientId).catch((error: unknown) => {
      setInvoiceStatus(error instanceof Error ? error.message : 'Failed to load invoice weeks');
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
        setInvoiceStatus(error instanceof Error ? error.message : 'Failed to load session breaks');
      });
  }, [selectedSessionIds]);

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
    if (!selectedClient || selectedWeeks.length === 0 || !preview) {
      setInvoiceStatus('Select a client and at least one week with uninvoiced sessions.');
      return;
    }

    if (selectedSessions.length === 0) {
      setInvoiceStatus('No sessions available for the selected weeks.');
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
      const invoiceId = createId();
      const result = await createInvoiceFromSessions({
        invoiceId,
        clientId: selectedClient.id,
        sessionIds: selectedSessionIds,
        hourlyRate: selectedClient.hourly_rate,
        mercury: syncToMercury
          ? {
              enabled: true,
              customerName: selectedClient.name,
              customerEmail: selectedClient.email ?? undefined,
              description: `Invoice for ${selectedWeeksLabel ?? `${selectedWeeks.length} week(s)`}`,
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
        Create invoices by client and week (Monday through Sunday). Line items are grouped by
        project, then task, with each session listed underneath.
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
        <Text className="text-xs uppercase tracking-wide text-muted">Weeks (Mon-Sun)</Text>
        <View className="flex-row flex-wrap gap-2">
          {weekOptions.map((week) => {
            const active = selectedWeekKeys.includes(week.key);
            return (
              <Pressable
                key={week.key}
                className={active ? 'rounded-full bg-secondary px-3 py-1.5' : 'rounded-full bg-primary px-3 py-1.5'}
                onPress={() =>
                  setSelectedWeekKeys((current) =>
                    current.includes(week.key)
                      ? current.filter((existing) => existing !== week.key)
                      : [...current, week.key],
                  )
                }
              >
                <View className="flex-row items-center gap-1.5">
                  {active ? <WeekCheckIcon color={scheme === 'dark' ? '#1a1f16' : '#ffffff'} /> : null}
                  <Text className={active ? 'font-semibold text-white' : 'font-semibold text-heading'}>
                    {week.label}
                  </Text>
                </View>
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
        disabled={isCreatingInvoice || !selectedClient || selectedWeekKeys.length === 0}
      >
        <Text className="text-center font-semibold text-white">
          {isCreatingInvoice ? 'Creating...' : 'Create Invoice'}
        </Text>
      </Pressable>

      <View className="gap-2 rounded-md border border-border bg-background p-3">
        <Text className="font-semibold text-heading">Invoice Preview Line Items</Text>
        {!preview ? <Text className="text-sm text-muted">Select a client and at least one week to preview.</Text> : null}
        {groupedLineItems.map((projectGroup) => (
          <View key={projectGroup.projectLabel} className="gap-1">
            <Text className="font-semibold text-heading">Project: {projectGroup.projectLabel}</Text>
            <View className="ml-3 mt-1 overflow-hidden rounded-md border border-border bg-card">
              <View className="flex-row border-b border-border bg-background px-2 py-1">
                <Text style={{ width: '56%' }} className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Task
                </Text>
                <Text style={{ width: '14%' }} className="text-right text-xs font-semibold uppercase tracking-wide text-muted">
                  Time
                </Text>
                <Text style={{ width: '14%' }} className="text-right text-xs font-semibold uppercase tracking-wide text-muted">
                  Rate
                </Text>
                <Text style={{ width: '16%' }} className="text-right text-xs font-semibold uppercase tracking-wide text-muted">
                  Amount
                </Text>
              </View>

              {projectGroup.tasks.map((taskGroup) => (
                <View key={taskGroup.taskLabel} className="border-b border-border/60 px-2 py-1.5">
                  <View className="flex-row py-0.5">
                    <Text style={{ width: '56%' }} className="text-xs font-semibold text-heading">
                      {taskGroup.taskLabel}
                    </Text>
                    <Text style={{ width: '14%' }} className="text-right text-xs text-foreground">
                      {taskGroup.totalHours.toFixed(2)}h
                    </Text>
                    <Text style={{ width: '14%' }} className="text-right text-xs text-foreground">
                      ${selectedClient?.hourly_rate.toFixed(2) ?? '0.00'}
                    </Text>
                    <Text style={{ width: '16%' }} className="text-right text-xs text-foreground">
                      ${taskGroup.totalAmount.toFixed(2)}
                    </Text>
                  </View>

                  <View className="mt-1 border border-border/50 bg-background">
                    <View className="flex-row border-b border-border/50 px-2 py-1">
                      <Text style={{ width: '40%' }} className="text-xs font-semibold uppercase tracking-wide text-muted">
                        Start
                      </Text>
                      <Text style={{ width: '40%' }} className="text-xs font-semibold uppercase tracking-wide text-muted">
                        End
                      </Text>
                      <Text style={{ width: '10%' }} className="text-right text-xs font-semibold uppercase tracking-wide text-muted">
                        Hrs
                      </Text>
                      <Text style={{ width: '10%' }} className="text-right text-xs font-semibold uppercase tracking-wide text-muted">
                        $
                      </Text>
                    </View>

                    {taskGroup.sessions.map((session, sessionIndex) => (
                      <View
                        key={session.id}
                        className={
                          sessionIndex % 2 === 0
                            ? 'border-b border-border/50 bg-primary/45 px-2 py-1'
                            : 'border-b border-border/50 px-2 py-1'
                        }
                      >
                        {deriveSessionTimelineRows({
                          session,
                          breaks: previewBreaksBySessionId[session.id] ?? [],
                          hourlyRate: selectedClient?.hourly_rate ?? 0,
                        }).map((row) => (
                          <View key={row.id} className="flex-row py-0.5">
                            <Text
                              style={{ width: '40%' }}
                              className={row.isBreak ? 'text-xs text-secondary' : 'text-xs text-foreground'}
                            >
                              {new Date(row.start_time).toLocaleString()}
                            </Text>
                            <Text
                              style={{ width: '40%' }}
                              className={row.isBreak ? 'text-xs text-secondary' : 'text-xs text-foreground'}
                            >
                              {new Date(row.end_time).toLocaleString()}
                            </Text>
                            <Text
                              style={{ width: '10%' }}
                              className={
                                row.isBreak
                                  ? 'text-right text-xs font-semibold text-secondary'
                                  : 'text-right text-xs text-foreground'
                              }
                            >
                              {row.isBreak ? 'Break' : row.hours.toFixed(2)}
                            </Text>
                            <Text
                              style={{ width: '10%' }}
                              className={row.isBreak ? 'text-right text-xs text-secondary' : 'text-right text-xs text-foreground'}
                            >
                              {row.isBreak ? '-' : row.amount.toFixed(2)}
                            </Text>
                          </View>
                        ))}
                        {session.notes ? <Text className="pt-0.5 text-xs text-foreground/70">Note: {session.notes}</Text> : null}
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
            <Text className="text-right text-sm font-semibold text-heading">
              Project total: ${projectGroup.totalAmount.toFixed(2)}
            </Text>
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
