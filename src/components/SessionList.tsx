import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { Session } from '@/database/db';
import { listRuntimeSessions } from '@/services/session-runtime';

function formatDuration(duration: number | null): string {
  if (duration === null) {
    return 'In progress';
  }

  const hours = Math.floor(duration / 3600);
  const minutes = Math.floor((duration % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

export function SessionList() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await listRuntimeSessions();
      setSessions(data.filter((session) => session.deleted_at === null));
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load sessions');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  return (
    <View className="gap-3 rounded-xl bg-card p-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-xl font-bold text-heading">Session List</Text>
        <Pressable className="rounded-md border border-border px-3 py-1" onPress={() => load()}>
          <Text className="text-sm font-medium text-heading">Refresh</Text>
        </Pressable>
      </View>

      {isLoading ? <Text className="text-muted">Loading sessions…</Text> : null}
      {error ? <Text className="text-red-600">{error}</Text> : null}

      {!isLoading && sessions.length === 0 ? (
        <Text className="text-muted">No sessions yet. Use the Clock In button on Dashboard.</Text>
      ) : null}

      {sessions.slice(0, 10).map((session) => (
        <View key={session.id} className="gap-1 rounded-md border border-border p-3">
          <Text className="font-semibold text-heading">{session.client}</Text>
          <Text className="text-xs text-muted">{new Date(session.start_time).toLocaleString()}</Text>
          <Text className="text-sm text-muted">Duration: {formatDuration(session.duration)}</Text>
          <Text className="text-xs text-muted">
            Status: {session.end_time ? 'Completed' : 'Running'}
            {session.invoice_id ? ' · Invoiced' : ' · Uninvoiced'}
          </Text>
        </View>
      ))}
    </View>
  );
}
