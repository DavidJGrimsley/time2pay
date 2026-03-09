import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { getUserProfile, initializeDatabase } from '@/database/db';
import {
  evaluateProfileCompletion,
  REQUIRED_PROFILE_FIELD_LABELS,
  type RequiredProfileField,
} from '@/services/profile-completion';
import { InlineNotice } from '@/components/inline-notice';
import { Timer } from './Timer';

type DashboardGateStatus = 'loading' | 'locked' | 'unlocked';

export function DashboardOverview() {
  const router = useRouter();
  const [gateStatus, setGateStatus] = useState<DashboardGateStatus>('loading');
  const [missingFields, setMissingFields] = useState<RequiredProfileField[]>([]);
  const [gateStatusMessage, setGateStatusMessage] = useState<string | null>(null);

  const refreshGate = useCallback(async (): Promise<void> => {
    setGateStatus('loading');
    setGateStatusMessage(null);

    try {
      await initializeDatabase();
      const profile = await getUserProfile();
      const completion = evaluateProfileCompletion(profile);
      setMissingFields(completion.missingFields);
      setGateStatus(completion.isComplete ? 'unlocked' : 'locked');
    } catch (error: unknown) {
      setMissingFields([]);
      setGateStatus('locked');
      setGateStatusMessage(
        error instanceof Error ? error.message : 'Failed to load profile requirements.',
      );
    }
  }, []);

  useEffect(() => {
    refreshGate().catch(() => undefined);
  }, [refreshGate]);

  useFocusEffect(
    useCallback(() => {
      refreshGate().catch(() => undefined);
    }, [refreshGate]),
  );

  const locked = gateStatus !== 'unlocked';
  const missingFieldSummary = useMemo(() => {
    if (missingFields.length === 0) {
      return 'Complete your business profile before using dashboard actions.';
    }

    return missingFields.map((field) => REQUIRED_PROFILE_FIELD_LABELS[field]).join(', ');
  }, [missingFields]);

  return (
    <View className="gap-3">
      <Text className="text-3xl font-extrabold text-heading">Dashboard</Text>
      <Text className="text-muted">Clock-in and out or create work sessions manually.</Text>

      {gateStatus === 'loading' ? (
        <View className="gap-2 rounded-xl border border-border bg-background p-4">
          <Text className="text-sm font-semibold text-heading">Checking profile requirements...</Text>
        </View>
      ) : null}

      {locked ? (
        <View className="gap-2 rounded-xl border border-border bg-background p-4">
          <Text className="text-sm font-semibold text-heading">
            Complete your profile to unlock dashboard actions.
          </Text>
          <Text className="text-sm text-muted">Required: {missingFieldSummary}</Text>
          {gateStatusMessage ? <InlineNotice tone="error" message={gateStatusMessage} /> : null}
          <Pressable
            className="self-start rounded-md bg-secondary px-3 py-2"
            onPress={() => router.push('/profile')}
          >
            <Text className="font-semibold text-white">Go to Profile</Text>
          </Pressable>
        </View>
      ) : null}

      <Timer gate={{ locked, missingFields }} />
    </View>
  );
}
