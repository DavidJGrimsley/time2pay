import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useStableWindowDimensions } from '@/hooks/use-stable-window-dimensions';
import {
  createProjectMilestone,
  createMilestoneChecklistItem,
  initializeDatabase,
  listMilestoneChecklistItemsByMilestoneIds,
  listProjectMilestones,
  setProjectMilestoneCompletion,
  updateMilestoneChecklistItem,
  type MilestoneChecklistItem,
  type ProjectMilestone,
} from '@/database/db';
import { InlineNotice } from '@/components/inline-notice';

type DashboardMilestonesProps = {
  projectId: string | null;
  projectName: string | null;
};

function createId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function DashboardMilestones({ projectId, projectName }: DashboardMilestonesProps) {
  const router = useRouter();
  const { width } = useStableWindowDimensions();
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
  const [checklist, setChecklist] = useState<Record<string, MilestoneChecklistItem[]>>({});
  const [newTitle, setNewTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [newChecklist, setNewChecklist] = useState<Record<string, string>>({});
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
      return;
    }

    const rows = await listProjectMilestones(projectId);
    const checklistRows = await listMilestoneChecklistItemsByMilestoneIds(rows.map((row) => row.id));
    setMilestones(rows);
    setChecklist(
      checklistRows.reduce<Record<string, MilestoneChecklistItem[]>>((grouped, item) => {
        grouped[item.milestone_id] = [...(grouped[item.milestone_id] ?? []), item];
        return grouped;
      }, {}),
    );
  }, [projectId]);

  useEffect(() => {
    initializeDatabase()
      .then(() => refresh())
      .catch((error: unknown) => setStatus(error instanceof Error ? error.message : 'Failed to load milestones.'));
  }, [projectId, refresh]);

  async function handleAddMilestone(): Promise<void> {
    const title = newTitle.trim();
    if (!projectId || !title) {
      setStatus('Enter a milestone title first.');
      return;
    }

    try {
      await createProjectMilestone({
        id: createId('milestone'),
        project_id: projectId,
        title,
        amount_type: 'fixed',
        amount_value: 0,
        completion_mode: 'toggle',
        due_note: null,
        sort_order: milestones.length,
      });
      setNewTitle('');
      setIsAdding(false);
      setStatus('Milestone added.');
      await refresh();
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : 'Failed to add milestone.');
    }
  }

  async function handleToggleChecklist(item: MilestoneChecklistItem): Promise<void> {
    try {
      const completed = !Boolean(item.is_completed);
      await updateMilestoneChecklistItem({
        id: item.id,
        label: item.label,
        sort_order: item.sort_order,
        is_completed: completed,
        completed_at: completed ? new Date().toISOString() : null,
      });
      await refresh();
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : 'Failed to update checklist item.');
    }
  }

  async function handleToggleMilestone(milestone: ProjectMilestone): Promise<void> {
    try {
      await setProjectMilestoneCompletion({
        milestoneId: milestone.id,
        isCompleted: !Boolean(milestone.is_completed),
      });
      await refresh();
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : 'Failed to update milestone.');
    }
  }

  async function handleAddChecklistItem(milestoneId: string): Promise<void> {
    const label = (newChecklist[milestoneId] ?? '').trim();
    if (!label) {
      setStatus('Enter checklist item text first.');
      return;
    }

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
      setStatus(error instanceof Error ? error.message : 'Failed to add checklist item.');
    }
  }

  return (
    <View className="gap-3 rounded-xl bg-card p-4" style={{ ...contentWidthStyle, alignSelf: 'center' }}>
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1 gap-1">
          <Text className="text-2xl font-bold text-heading">Milestones</Text>
          <Text className="text-sm text-muted">
            {projectName ? `For ${projectName}` : 'Select a project to manage milestones.'}
          </Text>
        </View>
        {projectId ? (
          <View className="flex-row gap-2">
            <Pressable
              className="rounded-md border border-border px-3 py-2"
              onPress={() => router.push('/projects')}
            >
              <Text className="font-semibold text-heading">Edit</Text>
            </Pressable>
            <Pressable className="rounded-md bg-secondary px-3 py-2" onPress={() => setIsAdding((current) => !current)}>
              <Text className="font-semibold text-white">{isAdding ? 'Cancel' : 'Add'}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
      {isAdding ? (
        <View className="flex-row gap-2">
          <TextInput
            value={newTitle}
            onChangeText={setNewTitle}
            placeholder="Milestone title"
            returnKeyType="done"
            onSubmitEditing={() => handleAddMilestone().catch(() => undefined)}
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-foreground"
          />
          <Pressable className="rounded-md bg-secondary px-3 py-2" onPress={() => handleAddMilestone().catch(() => undefined)}>
            <Text className="font-semibold text-white">Save</Text>
          </Pressable>
        </View>
      ) : null}
      {status ? <InlineNotice tone="neutral" message={status} /> : null}
      {projectId && milestones.length === 0 ? <Text className="text-sm text-muted">No milestones yet.</Text> : null}
      {milestones.map((milestone) => (
        <View key={milestone.id} className="gap-2 rounded-md border border-border bg-background p-3">
          <Pressable
            className="flex-row items-center gap-2"
            onPress={() => handleToggleMilestone(milestone).catch(() => undefined)}
          >
            <View className={milestone.is_completed ? 'h-5 w-5 rounded border border-secondary bg-secondary' : 'h-5 w-5 rounded border border-border'} />
            <Text className={milestone.is_completed ? 'font-semibold text-muted line-through' : 'font-semibold text-heading'}>
              {milestone.title}
            </Text>
          </Pressable>
          {(checklist[milestone.id] ?? []).map((item) => (
            <Pressable key={item.id} className="flex-row items-center gap-2 pl-7" onPress={() => handleToggleChecklist(item).catch(() => undefined)}>
              <View className={item.is_completed ? 'h-4 w-4 rounded border border-secondary bg-secondary' : 'h-4 w-4 rounded border border-border'} />
              <Text className={item.is_completed ? 'text-sm text-muted line-through' : 'text-sm text-foreground'}>{item.label}</Text>
            </Pressable>
          ))}
          <View className="flex-row gap-2 pl-7">
            <TextInput
              value={newChecklist[milestone.id] ?? ''}
              onChangeText={(value) => setNewChecklist((current) => ({ ...current, [milestone.id]: value }))}
              placeholder="Add checklist item"
              returnKeyType="done"
              onSubmitEditing={() => handleAddChecklistItem(milestone.id).catch(() => undefined)}
              className="flex-1 rounded-md border border-border bg-card px-3 py-2 text-foreground"
            />
            <Pressable
              className="rounded-md border border-border px-3 py-2"
              onPress={() => handleAddChecklistItem(milestone.id).catch(() => undefined)}
            >
              <Text className="font-semibold text-heading">Add</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}
