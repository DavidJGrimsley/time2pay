import { BottomSheet, Host } from '@expo/ui';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, useColorScheme, View } from 'react-native';
import {
  createProjectMilestone,
  getProjectById,
  getProjectMilestoneById,
  initializeDatabase,
  listProjectMilestones,
  updateProjectMilestone,
  type MilestoneCompletionMode,
  type Project,
  type ProjectMilestone,
} from '@/database/db';
import { PickerControl } from '@/components/picker-field';
import { InlineNotice, type NoticeTone } from '@/components/inline-notice';

export type DashboardMilestoneSheetMode = 'create' | 'edit';

type DashboardMilestoneSheetProps = {
  visible: boolean;
  mode: DashboardMilestoneSheetMode;
  projectId: string | null;
  milestoneId?: string | null;
  onDismiss: () => void;
  onSaved?: () => void;
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
  mode,
  projectId,
  milestoneId = null,
  onDismiss,
  onSaved,
}: DashboardMilestoneSheetProps) {
  const isDark = useColorScheme() === 'dark';
  const [project, setProject] = useState<Project | null>(null);
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
  const [editingMilestone, setEditingMilestone] = useState<ProjectMilestone | null>(null);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [amountType, setAmountType] = useState<'percent' | 'fixed'>('fixed');
  const [completionMode, setCompletionMode] = useState<MilestoneCompletionMode>('toggle');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!visible) {
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setNotice(null);

    initializeDatabase()
      .then(async () => {
        if (!projectId) {
          throw new Error('Choose a project on the Dashboard before managing milestones.');
        }

        const [nextProject, nextMilestones, nextMilestone] = await Promise.all([
          getProjectById(projectId),
          listProjectMilestones(projectId),
          mode === 'edit' && milestoneId ? getProjectMilestoneById(milestoneId) : Promise.resolve(null),
        ]);

        if (!nextProject) {
          throw new Error('The selected project could not be found.');
        }
        if (mode === 'edit' && (!nextMilestone || nextMilestone.project_id !== projectId)) {
          throw new Error('The selected milestone could not be found.');
        }
        if (cancelled) {
          return;
        }

        setProject(nextProject);
        setMilestones(nextMilestones);
        setEditingMilestone(nextMilestone);
        setTitle(nextMilestone?.title ?? '');
        setAmount(nextMilestone ? String(nextMilestone.amount_value) : '');
        setAmountType(nextMilestone?.amount_type ?? 'fixed');
        setCompletionMode(nextMilestone?.completion_mode ?? 'toggle');
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setProject(null);
          setMilestones([]);
          setEditingMilestone(null);
          setNotice({
            message: error instanceof Error ? error.message : 'Failed to load milestone editor.',
            tone: 'error',
          });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [milestoneId, mode, projectId, visible]);

  async function handleSave(): Promise<void> {
    if (!project) {
      setNotice({ message: 'Choose a project first.', tone: 'error' });
      return;
    }

    const amountValue = nonNegativeNumber(amount);
    if (!title.trim() || amountValue === null) {
      setNotice({ message: 'A milestone title and non-negative amount are required.', tone: 'error' });
      return;
    }
    if (amountType === 'percent' && project.pricing_mode !== 'milestone') {
      setNotice({ message: 'Percent milestones require milestone project pricing.', tone: 'error' });
      return;
    }

    const existingPercentTotal = milestones
      .filter((milestone) => milestone.id !== editingMilestone?.id && milestone.amount_type === 'percent')
      .reduce((sum, milestone) => sum + milestone.amount_value, 0);
    if (amountType === 'percent' && existingPercentTotal + amountValue > 100.0001) {
      setNotice({ message: 'Percent milestones cannot exceed 100% in total.', tone: 'error' });
      return;
    }

    setIsSaving(true);
    try {
      if (mode === 'edit') {
        if (!editingMilestone) {
          throw new Error('The selected milestone could not be found.');
        }
        await updateProjectMilestone({
          id: editingMilestone.id,
          title: title.trim(),
          amount_type: amountType,
          amount_value: amountValue,
          completion_mode: completionMode,
          due_note: editingMilestone.due_note,
          sort_order: editingMilestone.sort_order,
        });
      } else {
        await createProjectMilestone({
          id: createId('milestone'),
          project_id: project.id,
          title: title.trim(),
          amount_type: amountType,
          amount_value: amountValue,
          completion_mode: completionMode,
          due_note: null,
          sort_order: milestones.length,
        });
      }

      onSaved?.();
      onDismiss();
    } catch (error: unknown) {
      setNotice({
        message: error instanceof Error ? error.message : 'Failed to save milestone.',
        tone: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  }

  const isBusy = isLoading || isSaving;
  const isPercentAvailable = project?.pricing_mode === 'milestone' || amountType === 'percent';
  const sheetBackgroundColor = isDark ? '#1A1F16' : '#F8F7F3';

  return (
    <Host matchContents>
      <BottomSheet
        isPresented={visible}
        onDismiss={onDismiss}
        snapPoints={['half']}
        contentPadding={0}
        containerColor={sheetBackgroundColor}
        testID="dashboard-milestone-sheet"
      >
        <ScrollView
          className="max-h-[760px] bg-background px-5 pb-8 pt-4"
          style={{ backgroundColor: sheetBackgroundColor }}
        >
          <View className="gap-4">
            <View className="gap-1">
              <Text className="text-2xl font-bold text-heading">
                {mode === 'edit' ? 'Edit milestone' : 'Add milestone'}
              </Text>
              <Text className="text-sm text-muted">
                {project ? `For ${project.name}` : 'Complete this milestone setup from the Dashboard.'}
              </Text>
            </View>

            {notice ? <InlineNotice tone={notice.tone} message={notice.message} /> : null}
            {isLoading ? <Text className="text-sm text-muted">Loading milestone…</Text> : null}

            {project ? (
              <View className="gap-3 rounded-xl border border-border bg-card p-3">
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Milestone title"
                  editable={!isBusy}
                  className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
                />
                <View className="flex-row gap-2">
                  <View className="flex-1">
                    <PickerControl
                      selectedValue={amountType}
                      items={[
                        ...(isPercentAvailable ? [{ label: 'Percent', value: 'percent' }] : []),
                        { label: 'Fixed', value: 'fixed' },
                        ...(!isPercentAvailable
                          ? [
                              {
                                label: 'Percentage (disabled on hourly-priced projects)',
                                value: 'percent-unavailable',
                                disabled: true,
                              },
                            ]
                          : []),
                      ]}
                      disabled={isBusy}
                      onValueChange={(value) => setAmountType(value as 'percent' | 'fixed')}
                    />
                  </View>
                  <TextInput
                    value={amount}
                    onChangeText={setAmount}
                    placeholder={amountType === 'percent' ? 'Percent' : 'Amount'}
                    keyboardType="decimal-pad"
                    editable={!isBusy}
                    className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-foreground"
                  />
                </View>
                <PickerControl
                  selectedValue={completionMode}
                  items={[
                    { label: 'Simple completion', value: 'toggle' },
                    { label: 'Checklist completion', value: 'checklist' },
                  ]}
                  disabled={isBusy}
                  onValueChange={(value) => setCompletionMode(value as MilestoneCompletionMode)}
                />
                <View className="flex-row gap-2">
                  <Pressable
                    disabled={isBusy}
                    className={`rounded-md bg-secondary px-4 py-2 ${isBusy ? 'opacity-60' : ''}`}
                    onPress={() => handleSave().catch(() => undefined)}
                  >
                    <Text className="font-semibold text-white">
                      {isSaving ? 'Saving…' : mode === 'edit' ? 'Save milestone' : 'Add milestone'}
                    </Text>
                  </Pressable>
                  <Pressable
                    disabled={isSaving}
                    className="rounded-md border border-border px-4 py-2"
                    onPress={onDismiss}
                  >
                    <Text className="font-semibold text-heading">Cancel</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </BottomSheet>
    </Host>
  );
}
