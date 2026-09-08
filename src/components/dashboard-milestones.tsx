import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import {
  createMilestoneChecklistItem,
  initializeDatabase,
  listInvoices,
  listMilestoneChecklistItemsByMilestoneIds,
  listProjectMilestones,
  updateMilestoneChecklistItem,
  type MilestoneChecklistItem,
  type ProjectMilestone,
} from '@/database/db';
import { InlineNotice, type NoticeTone } from '@/components/inline-notice';
import { useStableWindowDimensions } from '@/hooks/use-stable-window-dimensions';
import { canMilestoneBeCompleted, setDashboardMilestoneCompletion } from '@/services/project-pricing';

type DashboardMilestonesProps = {
  projectId: string | null;
  projectName: string | null;
  refreshToken?: number;
  onAdd?: () => void;
  onEdit?: (milestoneId: string) => void;
};

type Status = {
  message: string;
  tone: NoticeTone;
};

function createId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function DashboardMilestones({
  projectId,
  projectName,
  refreshToken = 0,
  onAdd,
  onEdit,
}: DashboardMilestonesProps) {
  const { width } = useStableWindowDimensions();
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
  const [checklist, setChecklist] = useState<Record<string, MilestoneChecklistItem[]>>({});
  const [draftMilestoneIds, setDraftMilestoneIds] = useState<Set<string>>(new Set());
  const [newChecklist, setNewChecklist] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const contentWidthStyle =
    width >= 1200
      ? { width: '90%' as const, maxWidth: 1500 }
      : width >= 768
        ? { width: '75%' as const }
        : { width: '90%' as const };

  const refresh = useCallback(async (): Promise<void> => {
    if (!projectId) {
      setMilestones([]);
      setChecklist({});
      setDraftMilestoneIds(new Set());
      return;
    }

    const [rows, invoices] = await Promise.all([listProjectMilestones(projectId), listInvoices()]);
    const checklistRows = await listMilestoneChecklistItemsByMilestoneIds(rows.map((row) => row.id));
    setMilestones(rows);
    setChecklist(
      checklistRows.reduce<Record<string, MilestoneChecklistItem[]>>((grouped, item) => {
        (grouped[item.milestone_id] ??= []).push(item);
        return grouped;
      }, {}),
    );
    setDraftMilestoneIds(
      new Set(
        invoices
          .map((invoice) => invoice.source_milestone_id)
          .filter((id): id is string => Boolean(id)),
      ),
    );
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    initializeDatabase()
      .then(async () => {
        await refresh();
        if (!cancelled) {
          setStatus(null);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setStatus({
            message: error instanceof Error ? error.message : 'Failed to load milestones.',
            tone: 'error',
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [refresh, refreshToken]);

  async function handleToggleChecklist(item: MilestoneChecklistItem): Promise<void> {
    setBusyAction(`checklist:${item.id}`);
    try {
      const isCompleted = !Boolean(item.is_completed);
      await updateMilestoneChecklistItem({
        id: item.id,
        label: item.label,
        sort_order: item.sort_order,
        is_completed: isCompleted,
        completed_at: isCompleted ? new Date().toISOString() : null,
      });
      await refresh();
    } catch (error: unknown) {
      setStatus({
        message: error instanceof Error ? error.message : 'Failed to update checklist item.',
        tone: 'error',
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleToggleMilestone(milestone: ProjectMilestone): Promise<void> {
    setBusyAction(`milestone:${milestone.id}`);
    try {
      await setDashboardMilestoneCompletion({
        milestoneId: milestone.id,
        isCompleted: !Boolean(milestone.is_completed),
      });
      await refresh();
      setStatus({
        message: milestone.is_completed ? 'Milestone reopened.' : 'Milestone completed.',
        tone: 'success',
      });
    } catch (error: unknown) {
      setStatus({
        message: error instanceof Error ? error.message : 'Failed to update milestone.',
        tone: 'error',
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleAddChecklistItem(milestoneId: string): Promise<void> {
    const label = (newChecklist[milestoneId] ?? '').trim();
    if (!label) {
      setStatus({ message: 'Enter checklist item text first.', tone: 'error' });
      return;
    }

    setBusyAction(`add-checklist:${milestoneId}`);
    try {
      await createMilestoneChecklistItem({
        id: createId('checklist'),
        milestone_id: milestoneId,
        label,
        sort_order: (checklist[milestoneId] ?? []).length,
      });
      setNewChecklist((current) => ({ ...current, [milestoneId]: '' }));
      await refresh();
    } catch (error: unknown) {
      setStatus({
        message: error instanceof Error ? error.message : 'Failed to add checklist item.',
        tone: 'error',
      });
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <View
      className="gap-3 rounded-xl bg-card p-4"
      style={{ ...contentWidthStyle, alignSelf: 'center' }}
      testID="dashboard-milestones"
    >
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1 gap-1">
          <Text className="text-2xl font-bold text-heading">Milestones</Text>
          <Text className="text-sm text-muted">
            {projectName ? `For ${projectName}` : 'Select a project to view milestones.'}
          </Text>
        </View>
        {projectId && onAdd ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add milestone"
            className="rounded-md bg-secondary px-3 py-2"
            onPress={onAdd}
          >
            <Text className="font-semibold text-white">Add</Text>
          </Pressable>
        ) : null}
      </View>

      {status ? <InlineNotice tone={status.tone} message={status.message} /> : null}
      {!projectId ? <Text className="text-sm text-muted">Choose a customer and project in the time tracker first.</Text> : null}
      {projectId && milestones.length === 0 ? <Text className="text-sm text-muted">No milestones yet.</Text> : null}

      {milestones.map((milestone) => {
        const items = checklist[milestone.id] ?? [];
        const hasDraft = draftMilestoneIds.has(milestone.id);
        const checklistComplete = canMilestoneBeCompleted({ milestone, checklistItems: items });
        const canToggleCompletion = milestone.is_completed ? !hasDraft : checklistComplete;
        const isMilestoneBusy = busyAction === `milestone:${milestone.id}`;

        return (
          <View key={milestone.id} className="gap-2 rounded-lg border border-border bg-background p-3">
            <View className="flex-row items-start gap-3">
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: Boolean(milestone.is_completed), disabled: !canToggleCompletion || Boolean(busyAction) }}
                accessibilityLabel={`${milestone.title} completion`}
                disabled={!canToggleCompletion || Boolean(busyAction)}
                className={`mt-0.5 h-7 w-7 items-center justify-center rounded border ${
                  milestone.is_completed ? 'border-secondary bg-secondary' : 'border-border bg-card'
                } ${!canToggleCompletion || Boolean(busyAction) ? 'opacity-50' : ''}`}
                onPress={() => handleToggleMilestone(milestone).catch(() => undefined)}
              >
                {milestone.is_completed ? <Text className="font-bold text-white">✓</Text> : null}
              </Pressable>
              <View className="flex-1 gap-1">
                <Text className={milestone.is_completed ? 'font-semibold text-muted line-through' : 'font-semibold text-heading'}>
                  {milestone.title}
                </Text>
                <Text className="text-xs text-muted">
                  {milestone.amount_type === 'percent'
                    ? `${milestone.amount_value.toFixed(2)}%`
                    : `$${milestone.amount_value.toFixed(2)}`}{' '}
                  · {milestone.completion_mode}
                </Text>
              </View>
              {onEdit ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${milestone.title}`}
                  className="rounded-md border border-border px-3 py-2"
                  onPress={() => onEdit(milestone.id)}
                  disabled={Boolean(busyAction)}
                >
                  <Text className="font-semibold text-heading">Edit</Text>
                </Pressable>
              ) : null}
            </View>

            {milestone.completion_mode === 'checklist' ? (
              <View className="ml-10 gap-2 border-t border-border pt-2">
                {items.map((item) => (
                  <Pressable
                    key={item.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: Boolean(item.is_completed), disabled: Boolean(busyAction) }}
                    disabled={Boolean(busyAction)}
                    className="flex-row items-center gap-2"
                    onPress={() => handleToggleChecklist(item).catch(() => undefined)}
                  >
                    <View className={item.is_completed ? 'h-4 w-4 items-center justify-center rounded border border-secondary bg-secondary' : 'h-4 w-4 rounded border border-border'}>
                      {item.is_completed ? <Text className="text-[10px] text-white">✓</Text> : null}
                    </View>
                    <Text className={item.is_completed ? 'text-sm text-muted line-through' : 'text-sm text-foreground'}>{item.label}</Text>
                  </Pressable>
                ))}
                <View className="flex-row items-center gap-2">
                  <TextInput
                    value={newChecklist[milestone.id] ?? ''}
                    onChangeText={(value) => setNewChecklist((current) => ({ ...current, [milestone.id]: value }))}
                    placeholder="Add checklist item"
                    editable={!busyAction}
                    returnKeyType="done"
                    onSubmitEditing={() => handleAddChecklistItem(milestone.id).catch(() => undefined)}
                    className="min-w-0 flex-1 rounded-md border border-border bg-card px-3 py-2 text-foreground"
                  />
                  <Pressable
                    className="rounded-md border border-border px-3 py-2"
                    disabled={Boolean(busyAction)}
                    onPress={() => handleAddChecklistItem(milestone.id).catch(() => undefined)}
                  >
                    <Text className="font-semibold text-heading">
                      {busyAction === `add-checklist:${milestone.id}` ? 'Adding...' : 'Add'}
                    </Text>
                  </Pressable>
                </View>
                {!checklistComplete && !milestone.is_completed ? (
                  <Text className="text-xs text-muted">Complete every checklist item to finish this milestone.</Text>
                ) : null}
                {hasDraft ? <Text className="text-xs text-muted">Draft exists; this milestone cannot be reopened.</Text> : null}
              </View>
            ) : null}

            {isMilestoneBusy ? <Text className="text-xs text-muted">Saving milestone…</Text> : null}
          </View>
        );
      })}
    </View>
  );
}
