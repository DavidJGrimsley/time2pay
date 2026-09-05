import { BottomSheet, Host } from '@expo/ui';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import {
  createProjectMilestone,
  createMilestoneChecklistItem,
  initializeDatabase,
  listClients,
  listInvoices,
  listMilestoneChecklistItemsByMilestoneIds,
  listProjectMilestones,
  listProjectsByClient,
  updateMilestoneChecklistItem,
  type Client,
  type MilestoneChecklistItem,
  type MilestoneCompletionMode,
  type Project,
  type ProjectMilestone,
} from '@/database/db';
import { PickerControl, PickerField } from '@/components/picker-field';
import { InlineNotice, type NoticeTone } from '@/components/inline-notice';
import { setDashboardMilestoneCompletion } from '@/services/project-pricing';

type DashboardMilestoneSheetProps = {
  visible: boolean;
  initialSelection: { clientId: string | null; projectId: string | null } | null;
  onDismiss: () => void;
};

type Notice = { message: string; tone: NoticeTone };

function createId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function nonNegativeNumber(value: string): number | null {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function DashboardMilestoneSheet({
  visible,
  initialSelection,
  onDismiss,
}: DashboardMilestoneSheetProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clientId, setClientId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
  const [checklists, setChecklists] = useState<Record<string, MilestoneChecklistItem[]>>({});
  const [draftMilestoneIds, setDraftMilestoneIds] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [amountType, setAmountType] = useState<'percent' | 'fixed'>('fixed');
  const [completionMode, setCompletionMode] = useState<MilestoneCompletionMode>('toggle');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [newChecklistTextByMilestoneId, setNewChecklistTextByMilestoneId] = useState<Record<string, string>>({});

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === projectId) ?? null,
    [projectId, projects],
  );

  async function loadMilestones(nextProjectId: string | null): Promise<void> {
    if (!nextProjectId) {
      setMilestones([]);
      setChecklists({});
      setDraftMilestoneIds(new Set());
      return;
    }
    const [nextMilestones, invoices] = await Promise.all([
      listProjectMilestones(nextProjectId),
      listInvoices(),
    ]);
    const checklistRows = await listMilestoneChecklistItemsByMilestoneIds(
      nextMilestones.map((milestone) => milestone.id),
    );
    const grouped = checklistRows.reduce<Record<string, MilestoneChecklistItem[]>>((all, item) => {
      (all[item.milestone_id] ??= []).push(item);
      return all;
    }, {});
    setMilestones(nextMilestones);
    setChecklists(grouped);
    setDraftMilestoneIds(
      new Set(
        invoices
          .map((invoice) => invoice.source_milestone_id)
          .filter((id): id is string => Boolean(id)),
      ),
    );
  }

  async function loadProjects(nextClientId: string | null, preferredProjectId?: string | null): Promise<void> {
    if (!nextClientId) {
      setProjects([]);
      setProjectId(null);
      await loadMilestones(null);
      return;
    }
    const nextProjects = await listProjectsByClient(nextClientId);
    setProjects(nextProjects);
    const nextProjectId =
      preferredProjectId && nextProjects.some((project) => project.id === preferredProjectId)
        ? preferredProjectId
        : nextProjects[0]?.id ?? null;
    setProjectId(nextProjectId);
    await loadMilestones(nextProjectId);
  }

  useEffect(() => {
    if (!visible) {
      return;
    }
    setNotice(null);
    initializeDatabase()
      .then(async () => {
        const nextClients = await listClients();
        setClients(nextClients);
        const nextClientId =
          initialSelection?.clientId && nextClients.some((client) => client.id === initialSelection.clientId)
            ? initialSelection.clientId
            : nextClients[0]?.id ?? null;
        setClientId(nextClientId);
        await loadProjects(nextClientId, initialSelection?.projectId);
      })
      .catch((error: unknown) => {
        setNotice({
          message: error instanceof Error ? error.message : 'Failed to load milestone workspace.',
          tone: 'error',
        });
      });
  // Selection is deliberately refreshed only when the sheet opens or its seeded timer context changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSelection?.clientId, initialSelection?.projectId, visible]);

  async function handleCreate(): Promise<void> {
    if (!selectedProject) {
      setNotice({ message: 'Choose a customer and project first.', tone: 'error' });
      return;
    }
    const numericAmount = nonNegativeNumber(amount);
    if (!title.trim() || numericAmount === null) {
      setNotice({ message: 'A milestone title and non-negative amount are required.', tone: 'error' });
      return;
    }
    if (amountType === 'percent' && selectedProject.pricing_mode !== 'milestone') {
      setNotice({ message: 'Percent milestones require milestone project pricing.', tone: 'error' });
      return;
    }
    const currentPercent = milestones
      .filter((milestone) => milestone.amount_type === 'percent')
      .reduce((sum, milestone) => sum + milestone.amount_value, 0);
    if (amountType === 'percent' && currentPercent + numericAmount > 100.0001) {
      setNotice({ message: 'Percent milestones cannot exceed 100% in total.', tone: 'error' });
      return;
    }

    setIsBusy(true);
    try {
      await createProjectMilestone({
        id: createId('milestone'),
        project_id: selectedProject.id,
        title: title.trim(),
        amount_type: amountType,
        amount_value: numericAmount,
        completion_mode: completionMode,
        due_note: null,
        sort_order: milestones.length,
      });
      setTitle('');
      setAmount('');
      setCompletionMode('toggle');
      await loadMilestones(selectedProject.id);
      setNotice({ message: 'Milestone added to this project.', tone: 'success' });
    } catch (error: unknown) {
      setNotice({
        message: error instanceof Error ? error.message : 'Failed to add milestone.',
        tone: 'error',
      });
    } finally {
      setIsBusy(false);
    }
  }

  async function handleChecklistToggle(item: MilestoneChecklistItem): Promise<void> {
    if (!projectId) return;
    setIsBusy(true);
    try {
      const isCompleted = !Boolean(item.is_completed);
      await updateMilestoneChecklistItem({
        id: item.id,
        label: item.label,
        sort_order: item.sort_order,
        is_completed: isCompleted,
        completed_at: isCompleted ? new Date().toISOString() : null,
      });
      await loadMilestones(projectId);
    } catch (error: unknown) {
      setNotice({ message: error instanceof Error ? error.message : 'Failed to update checklist.', tone: 'error' });
    } finally {
      setIsBusy(false);
    }
  }

  async function handleCompletion(milestone: ProjectMilestone): Promise<void> {
    if (!projectId) return;
    setIsBusy(true);
    try {
      await setDashboardMilestoneCompletion({
        milestoneId: milestone.id,
        isCompleted: !Boolean(milestone.is_completed),
      });
      await loadMilestones(projectId);
      setNotice({
        message: milestone.is_completed ? 'Milestone reopened.' : 'Milestone completed. Create its draft from Invoices.',
        tone: 'success',
      });
    } catch (error: unknown) {
      setNotice({ message: error instanceof Error ? error.message : 'Failed to update milestone.', tone: 'error' });
    } finally {
      setIsBusy(false);
    }
  }

  async function handleAddChecklistItem(milestone: ProjectMilestone): Promise<void> {
    const label = (newChecklistTextByMilestoneId[milestone.id] ?? '').trim();
    if (!label) {
      setNotice({ message: 'Checklist item text is required.', tone: 'error' });
      return;
    }
    setIsBusy(true);
    try {
      const items = checklists[milestone.id] ?? [];
      await createMilestoneChecklistItem({
        id: createId('checklist'),
        milestone_id: milestone.id,
        label,
        sort_order: items.length,
      });
      setNewChecklistTextByMilestoneId((current) => ({ ...current, [milestone.id]: '' }));
      await loadMilestones(projectId);
    } catch (error: unknown) {
      setNotice({ message: error instanceof Error ? error.message : 'Failed to add checklist item.', tone: 'error' });
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <Host matchContents>
      <BottomSheet
        isPresented={visible}
        onDismiss={onDismiss}
        snapPoints={['half', 'full']}
        contentPadding={0}
        containerColor="#F8F7F3"
        testID="dashboard-milestone-sheet"
      >
        <ScrollView className="max-h-[760px] bg-background px-5 pb-8 pt-4">
          <View className="gap-4">
            <View className="gap-1">
              <Text className="text-2xl font-bold text-heading">Milestones</Text>
              <Text className="text-sm text-muted">Complete work here. Invoice drafts belong on Invoices.</Text>
            </View>

            <View className="gap-3 rounded-xl border border-border bg-card p-3">
              <PickerField
                label="Customer"
                value={clientId}
                options={clients.map((client) => ({ id: client.id, label: client.name }))}
                placeholder="Select customer"
                disabled={isBusy}
                onSelect={(nextClientId) => {
                  setClientId(nextClientId);
                  loadProjects(nextClientId).catch(() => undefined);
                }}
              />
              <PickerField
                label="Project"
                value={projectId}
                options={projects.map((project) => ({ id: project.id, label: project.name }))}
                placeholder={clientId ? 'Select project' : 'Select customer first'}
                disabled={isBusy || !clientId}
                onSelect={(nextProjectId) => {
                  setProjectId(nextProjectId);
                  loadMilestones(nextProjectId).catch(() => undefined);
                }}
              />
            </View>

            {selectedProject ? (
              <View className="gap-3 border-y border-border py-4">
                <Text className="text-sm font-semibold text-heading">Add milestone</Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Milestone title"
                  className="rounded-md border border-border bg-card px-3 py-2 text-foreground"
                />
                <View className="flex-row gap-2">
                  <View className="flex-1">
                    <PickerControl
                      selectedValue={amountType}
                      items={[
                        ...(selectedProject.pricing_mode === 'milestone'
                          ? [{ label: 'Percent', value: 'percent' }]
                          : []),
                        { label: 'Fixed', value: 'fixed' },
                      ]}
                      onValueChange={(value) => setAmountType(value as 'percent' | 'fixed')}
                    />
                  </View>
                  <TextInput
                    value={amount}
                    onChangeText={setAmount}
                    placeholder={amountType === 'percent' ? 'Percent' : 'Amount'}
                    keyboardType="decimal-pad"
                    className="flex-1 rounded-md border border-border bg-card px-3 py-2 text-foreground"
                  />
                </View>
                <PickerControl
                  selectedValue={completionMode}
                  items={[
                    { label: 'Simple completion', value: 'toggle' },
                    { label: 'Checklist completion', value: 'checklist' },
                  ]}
                  onValueChange={(value) => setCompletionMode(value as MilestoneCompletionMode)}
                />
                <Pressable
                  disabled={isBusy}
                  className={`self-start rounded-md bg-secondary px-4 py-2 ${isBusy ? 'opacity-60' : ''}`}
                  onPress={() => handleCreate().catch(() => undefined)}
                >
                  <Text className="font-semibold text-white">Add milestone</Text>
                </Pressable>
              </View>
            ) : null}

            {notice ? <InlineNotice tone={notice.tone} message={notice.message} /> : null}

            <View className="gap-2">
              {milestones.length === 0 && selectedProject ? (
                <Text className="text-sm text-muted">No milestones yet.</Text>
              ) : null}
              {milestones.map((milestone) => {
                const checklist = checklists[milestone.id] ?? [];
                const hasDraft = draftMilestoneIds.has(milestone.id);
                const checklistComplete =
                  milestone.completion_mode !== 'checklist' || checklist.every((item) => Boolean(item.is_completed));
                const canToggleCompletion = checklistComplete && !hasDraft;
                return (
                  <View key={milestone.id} className="gap-2 rounded-lg border border-border bg-card p-3">
                    <View className="flex-row items-start gap-3">
                      <Pressable
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: Boolean(milestone.is_completed), disabled: isBusy || !canToggleCompletion }}
                        accessibilityLabel={`${milestone.title} completion`}
                        disabled={isBusy || !canToggleCompletion}
                        className={`mt-0.5 h-7 w-7 items-center justify-center rounded border ${
                          milestone.is_completed ? 'border-secondary bg-secondary' : 'border-border bg-background'
                        } ${isBusy || !canToggleCompletion ? 'opacity-50' : ''}`}
                        onPress={() => handleCompletion(milestone).catch(() => undefined)}
                      >
                        {milestone.is_completed ? <Text className="font-bold text-white">✓</Text> : null}
                      </Pressable>
                      <View className="flex-1 gap-1">
                        <Text className={milestone.is_completed ? 'font-semibold text-muted line-through' : 'font-semibold text-heading'}>{milestone.title}</Text>
                        <Text className="text-xs text-muted">
                          {milestone.amount_type === 'percent'
                            ? `${milestone.amount_value.toFixed(2)}%`
                            : `$${milestone.amount_value.toFixed(2)}`}{' '}
                          · {milestone.completion_mode}
                        </Text>
                      </View>
                    </View>
                    {milestone.completion_mode === 'checklist' ? (
                      <View className="ml-10 gap-2 border-t border-border pt-2">
                        {checklist.map((item) => (
                          <Pressable
                            key={item.id}
                            disabled={isBusy}
                            className="flex-row items-center gap-2"
                            onPress={() => handleChecklistToggle(item).catch(() => undefined)}
                          >
                            <View className={item.is_completed ? 'h-4 w-4 items-center justify-center rounded border border-secondary bg-secondary' : 'h-4 w-4 rounded border border-border'}>
                              {item.is_completed ? <Text className="text-[10px] text-white">✓</Text> : null}
                            </View>
                            <Text className={item.is_completed ? 'text-sm text-muted line-through' : 'text-sm text-foreground'}>{item.label}</Text>
                          </Pressable>
                        ))}
                        <View className="flex-row items-center gap-2">
                          <TextInput
                            value={newChecklistTextByMilestoneId[milestone.id] ?? ''}
                            onChangeText={(value) => setNewChecklistTextByMilestoneId((current) => ({ ...current, [milestone.id]: value }))}
                            placeholder="Add checklist item"
                            className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-foreground"
                            editable={!isBusy}
                          />
                          <Pressable
                            disabled={isBusy}
                            className="rounded-md border border-border px-3 py-2"
                            onPress={() => handleAddChecklistItem(milestone).catch(() => undefined)}
                          >
                            <Text className="font-semibold text-heading">Add</Text>
                          </Pressable>
                        </View>
                        {!checklistComplete && !milestone.is_completed ? (
                          <Text className="text-xs text-muted">Complete every checklist item to finish this milestone.</Text>
                        ) : null}
                        {hasDraft ? <Text className="text-xs text-muted">Draft exists; this milestone cannot be reopened.</Text> : null}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </BottomSheet>
    </Host>
  );
}
