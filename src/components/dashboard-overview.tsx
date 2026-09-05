import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  getProfileCompletion,
  REQUIRED_PROFILE_FIELD_LABELS,
  type RequiredProfileField,
} from '@/services/profile-completion';
import { InlineNotice } from '@/components/inline-notice';
import { GitHubStartModal, type GitHubStartSelection } from './GitHubStartModal';
import { DashboardMilestoneSheet } from './dashboard-milestone-sheet';
import { Timer, type TimerSelectionHandoff } from './Timer';
import { useResolvedDataMode } from '@/hooks/use-resolved-data-mode';
import { useAuthUiStore } from '@/stores/auth-ui-store';

type DashboardGateStatus = 'loading' | 'locked' | 'unlocked';

export function DashboardOverview() {
  const router = useRouter();
  const { resolved: dataModeResolved } = useResolvedDataMode();
  const tourModeEnabled = useAuthUiStore((state) => state.tourModeEnabled);
  const shouldBypassProfileGate = dataModeResolved && tourModeEnabled;
  const [gateStatus, setGateStatus] = useState<DashboardGateStatus>('unlocked');
  const [missingFields, setMissingFields] = useState<RequiredProfileField[]>([]);
  const [gateStatusMessage, setGateStatusMessage] = useState<string | null>(null);
  const [isGitHubStartModalVisible, setIsGitHubStartModalVisible] = useState(false);
  const [timerSelectionHandoff, setTimerSelectionHandoff] = useState<TimerSelectionHandoff | null>(
    null,
  );
  const [milestoneSelection, setMilestoneSelection] = useState<{
    clientId: string | null;
    projectId: string | null;
  } | null>(null);

  const refreshGate = useCallback(async (options?: { showLoading?: boolean }): Promise<void> => {
    const showLoading = options?.showLoading ?? true;

    if (shouldBypassProfileGate) {
      setMissingFields([]);
      setGateStatus('unlocked');
      setGateStatusMessage(null);
      return;
    }

    if (showLoading) {
      setGateStatus('loading');
    }
    setGateStatusMessage(null);

    try {
      const completion = await getProfileCompletion();
      setMissingFields(completion.missingFields);
      setGateStatus(completion.isComplete ? 'unlocked' : 'locked');
    } catch (error: unknown) {
      setMissingFields([]);
      setGateStatus('locked');
      setGateStatusMessage(
        error instanceof Error ? error.message : 'Failed to load profile requirements.',
      );
    }
  }, [shouldBypassProfileGate]);

  useEffect(() => {
    refreshGate({ showLoading: false }).catch(() => undefined);
  }, [refreshGate]);

  useFocusEffect(
    useCallback(() => {
      refreshGate({ showLoading: false }).catch(() => undefined);
    }, [refreshGate]),
  );

  const locked = !shouldBypassProfileGate && gateStatus !== 'unlocked';
  const missingFieldSummary = useMemo(() => {
    if (missingFields.length === 0) {
      return 'Complete your business profile before using dashboard actions.';
    }

    return missingFields.map((field) => REQUIRED_PROFILE_FIELD_LABELS[field]).join(', ');
  }, [missingFields]);

  function handleGitHubStartComplete(selection: GitHubStartSelection): void {
    setTimerSelectionHandoff({
      handoffId: `github_start_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      clientId: selection.clientId,
      projectId: selection.projectId,
      taskId: selection.taskId,
    });
    setIsGitHubStartModalVisible(false);
  }

  return (
    <View className="gap-3">
      <Text className="text-3xl font-extrabold text-heading">Dashboard</Text>
      <Text className="text-muted">Keep work moving: set context, run the timer, and complete milestones.</Text>

      {locked ? (
        <View className="gap-2 rounded-xl border border-border bg-background p-4">
          <Text className="text-sm font-semibold text-heading">
            Complete your profile to unlock dashboard actions.
          </Text>
          <Text className="text-sm text-muted">Required: {missingFieldSummary}</Text>
          {gateStatusMessage ? <InlineNotice tone="error" message={gateStatusMessage} /> : null}
          <Pressable
            className="self-start rounded-md bg-secondary px-3 py-2"
            onPress={() => router.push('/settings')}
          >
            <Text className="font-semibold text-white">Go to Settings</Text>
          </Pressable>
        </View>
      ) : null}

      <Timer
        gate={{ locked, missingFields }}
        selectionHandoff={timerSelectionHandoff}
        onOpenGitHubStart={() => setIsGitHubStartModalVisible(true)}
        onOpenMilestones={(selection) => setMilestoneSelection(selection)}
      />
      <GitHubStartModal
        visible={isGitHubStartModalVisible}
        onClose={() => setIsGitHubStartModalVisible(false)}
        onComplete={handleGitHubStartComplete}
      />
      <DashboardMilestoneSheet
        visible={milestoneSelection !== null}
        initialSelection={milestoneSelection}
        onDismiss={() => setMilestoneSelection(null)}
      />
    </View>
  );
}
