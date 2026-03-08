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

function getSessionStatus(session: Session): string {
  if (session.end_time) {
    return 'Completed';
  }

  if (session.is_paused) {
    return 'Paused';
  }

  return 'Running';
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

      {isLoading ? <Text className="text-muted">Loading sessions...</Text> : null}
      {error ? <Text className="text-red-600">{error}</Text> : null}

      {!isLoading && sessions.length === 0 ? (
        <Text className="text-muted">No sessions yet. Use Clock In on Dashboard.</Text>
      ) : null}

      {sessions.slice(0, 10).map((session) => (
        <View key={session.id} className="gap-1 rounded-md border border-border p-3">
          <Text className="font-semibold text-heading">{session.client_name ?? session.client}</Text>
          <Text className="text-sm text-muted">
            {session.project_name ?? 'No project'} | {session.task_name ?? 'No task'}
          </Text>
          <Text className="text-xs text-muted">{new Date(session.start_time).toLocaleString()}</Text>
          <Text className="text-sm text-muted">Duration: {formatDuration(session.duration)}</Text>
          {session.notes ? <Text className="text-sm text-muted">Notes: {session.notes}</Text> : null}
          {typeof session.break_count === 'number' && session.break_count > 0 ? (
            <Text className="text-xs text-muted">Breaks: {session.break_count}</Text>
          ) : null}
          <Text className="text-xs text-muted">
            Status: {getSessionStatus(session)}
            {session.invoice_id ? ' | Invoiced' : ' | Uninvoiced'}
          </Text>
        </View>
      ))}
    </View>
  );
}
