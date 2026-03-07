import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { Session } from '@/database/db';
import { listRuntimeSessions, startRuntimeSession, stopRuntimeSession } from '@/services/session-runtime';

function formatSeconds(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600)
    .toString()
    .padStart(2, '0');
  const minutes = Math.floor((safe % 3600) / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (safe % 60).toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

function createSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function Timer() {
  const [clientName, setClientName] = useState('Default Client');
  const [notes, setNotes] = useState('');
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const isClockedIn = useMemo(() => !!activeSession, [activeSession]);

  async function refreshActiveSession(): Promise<void> {
    const sessions = await listRuntimeSessions();
    const running = sessions.find((session) => session.end_time === null) ?? null;
    setActiveSession(running);

    if (!running) {
      setElapsedSeconds(0);
      return;
    }

    const startMs = new Date(running.start_time).getTime();
    const nowMs = Date.now();
    setElapsedSeconds(Math.max(0, Math.floor((nowMs - startMs) / 1000)));
  }

  useEffect(() => {
    refreshActiveSession()
      .catch((error: unknown) => {
        setMessage(error instanceof Error ? error.message : 'Failed to initialize timer');
      })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (!activeSession) {
      return;
    }

    const interval = setInterval(() => {
      const startMs = new Date(activeSession.start_time).getTime();
      const nowMs = Date.now();
      setElapsedSeconds(Math.max(0, Math.floor((nowMs - startMs) / 1000)));
    }, 1000);

    return () => clearInterval(interval);
  }, [activeSession]);

  async function handleClockIn(): Promise<void> {
    setMessage(null);
    const trimmedClient = clientName.trim();
    if (!trimmedClient) {
      setMessage('Client name is required before clocking in.');
      return;
    }

    try {
      await startRuntimeSession({
        id: createSessionId(),
        client: trimmedClient,
        notes: notes.trim() ? notes.trim() : null,
      });
      await refreshActiveSession();
      setNotes('');
      setMessage('Clocked in successfully.');
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'Failed to clock in.');
    }
  }

  async function handleClockOut(): Promise<void> {
    if (!activeSession) {
      return;
    }

    setMessage(null);

    try {
      await stopRuntimeSession(activeSession.id);
      await refreshActiveSession();
      setMessage('Clocked out successfully.');
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'Failed to clock out.');
    }
  }

  return (
    <View className="gap-3 rounded-xl bg-card p-4">
      <Text className="text-xl font-bold text-heading">Timer</Text>
      <Text className="text-muted">{isClockedIn ? 'Currently clocked in' : 'Currently clocked out'}</Text>

      <View className="gap-2">
        <Text className="text-xs uppercase tracking-wide text-muted">Client</Text>
        <TextInput
          value={clientName}
          onChangeText={setClientName}
          placeholder="Client name"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
          editable={!isClockedIn}
        />
      </View>

      <View className="gap-2">
        <Text className="text-xs uppercase tracking-wide text-muted">Notes</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Optional notes"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
          editable={!isClockedIn}
        />
      </View>

      <Text className="text-3xl font-black text-heading">{formatSeconds(elapsedSeconds)}</Text>

      {isClockedIn ? (
        <Pressable className="rounded-md bg-red-600 px-4 py-3" onPress={handleClockOut}>
          <Text className="text-center font-semibold text-white">Clock Out</Text>
        </Pressable>
      ) : (
        <Pressable
          className="rounded-md bg-primary px-4 py-3"
          onPress={handleClockIn}
          disabled={isLoading}
        >
          <Text className="text-center font-semibold text-white">Clock In</Text>
        </Pressable>
      )}

      {message ? <Text className="text-sm text-muted">{message}</Text> : null}
    </View>
  );
}
