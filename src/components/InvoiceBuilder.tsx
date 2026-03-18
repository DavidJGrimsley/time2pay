import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  initializeDatabase,
  listClients,
  listProjectsByClient,
  listSessionBreaksBySessionIds,
  listSessions,
  type Client,
  type Project,
  type Session,
  type SessionBreak,
} from '@/database/db';
import {
  computeInvoiceTotals,
  createInvoiceFromSessions,
  groupSessionBreaksBySessionId,
  type InvoiceComputation,
} from '@/services/invoice';
import { InlineNotice, type NoticeTone } from '@/components/inline-notice';
import {
  SessionInvoiceSourcePanel,
  buildGroupedLineItems,
  buildWeekOptionsForClient,
  type WeekOption,
} from '@/components/session-invoice-source-panel';
import { showActionErrorAlert, showValidationAlert } from '@/services/system-alert';

type InvoiceBuilderProps = {
  onInvoiceCreated?: () => void;
};

type StatusNotice = {
  message: string;
  tone: NoticeTone;
};

function createId(prefix?: string): string {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return prefix ? `${prefix}_${suffix}` : suffix;
}

export function InvoiceBuilder({ onInvoiceCreated }: InvoiceBuilderProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [weekOptions, setWeekOptions] = useState<WeekOption[]>([]);
  const [selectedWeekKeys, setSelectedWeekKeys] = useState<string[]>([]);
  const [invoiceStatus, setInvoiceStatus] = useState<StatusNotice>({
    message: 'No invoice created yet.',
    tone: 'neutral',
  });
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [previewBreaksBySessionId, setPreviewBreaksBySessionId] = useState<
    Record<string, SessionBreak[]>
  >({});

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
      setProjects([]);
      setSelectedProjectId(null);
      setWeekOptions([]);
      setSelectedWeekKeys([]);
      return;
    }

    const projectRows = await listProjectsByClient(clientId);
    setProjects(projectRows);
    setSelectedProjectId((current) => {
      if (current && projectRows.some((project) => project.id === current)) {
        return current;
      }
      return null;
    });
  }

  async function refreshWeeksForSelection(input: {
    clientId: string | null;
    projectId: string | null;
  }): Promise<void> {
    if (!input.clientId) {
      setWeekOptions([]);
      setSelectedWeekKeys([]);
      return;
    }

    const allSessions = await listSessions();
    const uninvoiced = allSessions.filter(
      (session) =>
        session.client_id === input.clientId &&
        (input.projectId === null || session.project_id === input.projectId) &&
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
        setInvoiceStatus({
          message: error instanceof Error ? error.message : 'Failed to load clients.',
          tone: 'error',
        });
      });
  }, []);

  useEffect(() => {
    refreshWeeksForClient(selectedClientId).catch((error: unknown) => {
      setInvoiceStatus({
        message: error instanceof Error ? error.message : 'Failed to load projects.',
        tone: 'error',
      });
    });
  }, [selectedClientId]);

  useEffect(() => {
    refreshWeeksForSelection({
      clientId: selectedClientId,
      projectId: selectedProjectId,
    }).catch((error: unknown) => {
      setInvoiceStatus({
        message: error instanceof Error ? error.message : 'Failed to load invoice weeks.',
        tone: 'error',
      });
    });
  }, [selectedClientId, selectedProjectId]);

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
        setInvoiceStatus({
          message: error instanceof Error ? error.message : 'Failed to load session breaks.',
          tone: 'error',
        });
      });
  }, [selectedSessionIds]);

  async function handleCreateInvoice(): Promise<void> {
    if (!selectedClient || selectedWeeks.length === 0 || !preview) {
      const message = 'Select a client and at least one week with uninvoiced sessions.';
      showValidationAlert(message);
      setInvoiceStatus({ message, tone: 'error' });
      return;
    }

    if (selectedSessions.length === 0) {
      const message = 'No sessions available for the selected weeks.';
      showValidationAlert(message);
      setInvoiceStatus({ message, tone: 'error' });
      return;
    }

    setIsCreatingInvoice(true);
    setInvoiceStatus({ message: 'Creating local invoice...', tone: 'neutral' });

    try {
      const invoiceId = createId('invoice');
      const result = await createInvoiceFromSessions({
        invoiceId,
        clientId: selectedClient.id,
        sessionIds: selectedSessionIds,
        hourlyRate: selectedClient.hourly_rate,
      });

      setInvoiceStatus({
        message: `Invoice ${invoiceId} created for ${selectedClient.name}. Total $${result.totalAmount.toFixed(2)}.`,
        tone: 'success',
      });

      await refreshWeeksForSelection({
        clientId: selectedClient.id,
        projectId: selectedProjectId,
      });
      onInvoiceCreated?.();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create invoice.';
      showActionErrorAlert(message);
      setInvoiceStatus({ message, tone: 'error' });
    } finally {
      setIsCreatingInvoice(false);
    }
  }

  return (
    <View className="gap-3 rounded-xl bg-card p-4">
      <Text className="text-xl font-bold text-heading">Invoice Builder</Text>
      <Text className="text-muted">
        Standard Time2Pay invoice flow. This creates the local invoice record and keeps the PDF-based workflow intact.
      </Text>

      <SessionInvoiceSourcePanel
        clients={clients}
        selectedClientId={selectedClientId}
        onSelectClient={setSelectedClientId}
        projects={projects}
        selectedProjectId={selectedProjectId}
        onSelectProject={setSelectedProjectId}
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

      <Pressable
        className="rounded-md bg-secondary px-4 py-2"
        onPress={handleCreateInvoice}
        disabled={isCreatingInvoice || !selectedClient || selectedWeekKeys.length === 0}
      >
        <Text className="text-center font-semibold text-white">
          {isCreatingInvoice ? 'Creating...' : 'Create Invoice'}
        </Text>
      </Pressable>

      <InlineNotice tone={invoiceStatus.tone} message={invoiceStatus.message} />
    </View>
  );
}
