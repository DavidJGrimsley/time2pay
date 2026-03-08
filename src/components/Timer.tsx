import { Picker } from '@react-native-picker/picker';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import {
  createClient,
  createProject,
  createTask,
  initializeDatabase,
  listClients,
  listProjectsByClient,
  listTasksByProject,
  updateSessionNotes,
  type Client,
  type Project,
  type Session,
  type Task,
} from '@/database/db';
import {
  createRuntimeManualSession,
  getRuntimeSessionState,
  pauseRuntimeSession,
  resumeRuntimeSession,
  startRuntimeSession,
  stopRuntimeSession,
} from '@/services/session-runtime';
import {
  SessionCompleteModal,
  type SessionCompleteResult,
} from '@/components/SessionCompleteModal';
import { CalendarDateField } from '@/components/calendar-date-field';

const LAST_SELECTIONS_KEY = 'time2pay.timer.last-selection';
const EMPTY_PICKER_VALUE = '';
const CREATE_CLIENT_PICKER_VALUE = '__create_client__';
const CREATE_PROJECT_PICKER_VALUE = '__create_project__';
const CREATE_TASK_PICKER_VALUE = '__create_task__';

type LastSelection = {
  clientId: string | null;
  projectId: string | null;
  taskId: string | null;
};

type Option = {
  id: string;
  label: string;
};

type PickerFieldProps = {
  label: string;
  value: string | null;
  options: Option[];
  placeholder: string;
  createValue: string;
  disabled?: boolean;
  onSelect: (value: string | null) => void;
  onCreateNew: () => void;
};

function ClockIcon({ color = '#ffffff' }: { color?: string }) {
  return (
    <View className="h-5 w-5 items-center justify-center">
      <View
        style={{
          width: 16,
          height: 16,
          borderWidth: 2,
          borderColor: color,
          borderRadius: 999,
          position: 'relative',
        }}
      >
        <View
          style={{
            position: 'absolute',
            left: 6,
            top: 2,
            width: 2,
            height: 5,
            borderRadius: 2,
            backgroundColor: color,
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: 6,
            top: 6,
            width: 5,
            height: 2,
            borderRadius: 2,
            backgroundColor: color,
          }}
        />
      </View>
    </View>
  );
}

function PickerField({
  label,
  value,
  options,
  placeholder,
  createValue,
  disabled = false,
  onSelect,
  onCreateNew,
}: PickerFieldProps) {
  function handleValueChange(itemValue: string | number): void {
    const next = String(itemValue ?? EMPTY_PICKER_VALUE);
    if (next === createValue) {
      onCreateNew();
      return;
    }

    onSelect(next || null);
  }

  return (
    <View className="gap-2">
      <Text className="text-xs uppercase tracking-wide text-muted">{label}</Text>
      <View className={`rounded-md border border-border bg-background ${disabled ? 'opacity-60' : ''}`}>
        <Picker
          enabled={!disabled}
          selectedValue={value ?? EMPTY_PICKER_VALUE}
          onValueChange={handleValueChange}
          dropdownIconColor="#1a1f16"
          style={{ color: '#1a1f16' }}
        >
          <Picker.Item label={placeholder} value={EMPTY_PICKER_VALUE} />
          {options.map((option) => (
            <Picker.Item key={option.id} label={option.label} value={option.id} />
          ))}
          <Picker.Item label="+ Create new" value={createValue} />
        </Picker>
      </View>
    </View>
  );
}

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

function computeBillableElapsedSeconds(session: Session, nowMs: number): number {
  const sessionStart = new Date(session.start_time).getTime();
  if (!Number.isFinite(sessionStart)) {
    return 0;
  }

  const sessionEnd = session.end_time ? new Date(session.end_time).getTime() : nowMs;
  const boundedSessionEnd = Math.max(sessionStart, Number.isFinite(sessionEnd) ? sessionEnd : nowMs);
  const totalSessionMs = boundedSessionEnd - sessionStart;

  if (totalSessionMs <= 0) {
    return 0;
  }

  return Math.floor(totalSessionMs / 1000);
}

function computeBillableElapsedSecondsWithBreaks(
  session: Session,
  breakIntervals: { start_time: string; end_time: string | null }[],
  nowMs: number,
): number {
  const sessionStart = new Date(session.start_time).getTime();
  if (!Number.isFinite(sessionStart)) {
    return 0;
  }

  const rawSessionEnd = session.end_time ? new Date(session.end_time).getTime() : nowMs;
  const sessionEnd = Math.max(sessionStart, Number.isFinite(rawSessionEnd) ? rawSessionEnd : nowMs);
  const totalSessionMs = sessionEnd - sessionStart;
  if (totalSessionMs <= 0) {
    return 0;
  }

  const intervals = breakIntervals
    .map((sessionBreak) => {
      const breakStart = new Date(sessionBreak.start_time).getTime();
      if (!Number.isFinite(breakStart)) {
        return null;
      }

      const breakEndRaw = sessionBreak.end_time ? new Date(sessionBreak.end_time).getTime() : nowMs;
      const breakEnd = Number.isFinite(breakEndRaw) ? breakEndRaw : nowMs;
      const clampedStart = Math.max(sessionStart, breakStart);
      const clampedEnd = Math.min(sessionEnd, Math.max(breakStart, breakEnd));

      if (clampedEnd <= clampedStart) {
        return null;
      }

      return [clampedStart, clampedEnd] as const;
    })
    .filter((interval): interval is readonly [number, number] => interval !== null)
    .sort((a, b) => a[0] - b[0]);

  let breakMs = 0;
  if (intervals.length > 0) {
    let currentStart = intervals[0][0];
    let currentEnd = intervals[0][1];

    for (let index = 1; index < intervals.length; index += 1) {
      const [nextStart, nextEnd] = intervals[index];
      if (nextStart <= currentEnd) {
        currentEnd = Math.max(currentEnd, nextEnd);
        continue;
      }

      breakMs += currentEnd - currentStart;
      currentStart = nextStart;
      currentEnd = nextEnd;
    }

    breakMs += currentEnd - currentStart;
  }

  const billedMs = Math.max(0, totalSessionMs - breakMs);
  return Math.floor(billedMs / 1000);
}

function createId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function toLocalDatePart(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toLocalTimePart(date: Date): string {
  return formatTime12Hour(date.getHours(), date.getMinutes());
}

function toLocalDateTimeParts(date: Date): { datePart: string; timePart: string } {
  return {
    datePart: toLocalDatePart(date),
    timePart: toLocalTimePart(date),
  };
}

function formatTime12Hour(hours24: number, minutes: number): string {
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hour12 = hours24 % 12 || 12;
  return `${hour12}:${String(minutes).padStart(2, '0')} ${period}`;
}

function parseTimeInputTo24Hour(value: string): { hours24: number; minutes: number } | null {
  const trimmed = value.trim().toUpperCase();
  const twelveHourMatch = trimmed.match(/^(\d{1,2}):(\d{1,2})\s*([AP]M)$/);
  if (twelveHourMatch) {
    const hour12 = Number(twelveHourMatch[1]);
    const minutes = Number(twelveHourMatch[2]);
    const period = twelveHourMatch[3];
    if (!Number.isInteger(hour12) || !Number.isInteger(minutes)) {
      return null;
    }
    if (hour12 < 1 || hour12 > 12 || minutes < 0 || minutes > 59) {
      return null;
    }

    const hours24 = period === 'PM' ? (hour12 % 12) + 12 : hour12 % 12;
    return { hours24, minutes };
  }

  // Backward-compatible fallback for legacy 24-hour input.
  const twentyFourHourMatch = trimmed.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!twentyFourHourMatch) {
    return null;
  }

  const hours24 = Number(twentyFourHourMatch[1]);
  const minutes = Number(twentyFourHourMatch[2]);
  if (!Number.isInteger(hours24) || !Number.isInteger(minutes)) {
    return null;
  }
  if (hours24 < 0 || hours24 > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return { hours24, minutes };
}

function normalizeTimeInput(value: string): string | null {
  const parsed = parseTimeInputTo24Hour(value);
  if (!parsed) {
    return null;
  }

  return formatTime12Hour(parsed.hours24, parsed.minutes);
}

function toIsoFromLocalDateAndTime(datePart: string, timePart: string): string | null {
  if (!datePart) {
    return null;
  }

  const parsedTime = parseTimeInputTo24Hour(timePart);
  if (!parsedTime) {
    return null;
  }

  const parsed = new Date(
    `${datePart}T${String(parsedTime.hours24).padStart(2, '0')}:${String(parsedTime.minutes).padStart(2, '0')}:00`,
  );
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function loadLastSelection(): LastSelection {
  if (typeof localStorage === 'undefined') {
    return { clientId: null, projectId: null, taskId: null };
  }

  try {
    const raw = localStorage.getItem(LAST_SELECTIONS_KEY);
    if (!raw) {
      return { clientId: null, projectId: null, taskId: null };
    }

    const parsed = JSON.parse(raw) as LastSelection;
    return {
      clientId: parsed.clientId ?? null,
      projectId: parsed.projectId ?? null,
      taskId: parsed.taskId ?? null,
    };
  } catch {
    return { clientId: null, projectId: null, taskId: null };
  }
}

function saveLastSelection(selection: LastSelection): void {
  if (typeof localStorage === 'undefined') {
    return;
  }

  localStorage.setItem(LAST_SELECTIONS_KEY, JSON.stringify(selection));
}

export function Timer() {
  const defaults = loadLastSelection();
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  const [selectedClientId, setSelectedClientId] = useState<string | null>(defaults.clientId);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(defaults.projectId);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(defaults.taskId);

  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);

  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientRate, setNewClientRate] = useState('');
  const [newClientGithubOrg, setNewClientGithubOrg] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectGithubRepo, setNewProjectGithubRepo] = useState('');
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskGithubBranch, setNewTaskGithubBranch] = useState('');
  const [isCreatingManualSession, setIsCreatingManualSession] = useState(false);
  const [manualStartDate, setManualStartDate] = useState(() =>
    toLocalDateTimeParts(new Date(Date.now() - 60 * 60 * 1000)).datePart,
  );
  const [manualStartTime, setManualStartTime] = useState(() =>
    toLocalDateTimeParts(new Date(Date.now() - 60 * 60 * 1000)).timePart,
  );
  const [manualEndDate, setManualEndDate] = useState(() => toLocalDateTimeParts(new Date()).datePart);
  const [manualEndTime, setManualEndTime] = useState(() => toLocalDateTimeParts(new Date()).timePart);
  const [manualNotes, setManualNotes] = useState('');

  const [notes, setNotes] = useState('');
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [activeBreaks, setActiveBreaks] = useState<{ start_time: string; end_time: string | null }[]>(
    [],
  );
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completedSessionId, setCompletedSessionId] = useState<string | null>(null);
  const [completedSessionNotes, setCompletedSessionNotes] = useState<string | null>(null);

  const isClockedIn = useMemo(() => !!activeSession, [activeSession]);
  const manualRangeError = useMemo(() => {
    if (!isCreatingManualSession || isClockedIn) {
      return null;
    }

    const startIso = toIsoFromLocalDateAndTime(manualStartDate, manualStartTime);
    const endIso = toIsoFromLocalDateAndTime(manualEndDate, manualEndTime);
    if (!startIso || !endIso) {
      return 'Use valid start/end date and time (e.g. 1:30 PM).';
    }

    if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
      return 'End time must be after start time.';
    }

    return null;
  }, [isCreatingManualSession, isClockedIn, manualStartDate, manualStartTime, manualEndDate, manualEndTime]);

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === selectedClientId) ?? null,
    [clients, selectedClientId],
  );
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );
  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) ?? null,
    [tasks, selectedTaskId],
  );

  async function refreshClients(): Promise<void> {
    const clientRows = await listClients();
    setClients(clientRows);
    setSelectedClientId((current) => {
      if (current && clientRows.some((client) => client.id === current)) {
        return current;
      }
      return clientRows[0]?.id ?? null;
    });
  }

  async function refreshProjects(clientId: string | null): Promise<void> {
    if (!clientId) {
      setProjects([]);
      setSelectedProjectId(null);
      return;
    }

    const projectRows = await listProjectsByClient(clientId);
    setProjects(projectRows);
    setSelectedProjectId((current) => {
      if (current && projectRows.some((project) => project.id === current)) {
        return current;
      }
      return projectRows[0]?.id ?? null;
    });
  }

  async function refreshTasks(projectId: string | null): Promise<void> {
    if (!projectId) {
      setTasks([]);
      setSelectedTaskId(null);
      return;
    }

    const taskRows = await listTasksByProject(projectId);
    setTasks(taskRows);
    setSelectedTaskId((current) => {
      if (current && taskRows.some((task) => task.id === current)) {
        return current;
      }
      return taskRows[0]?.id ?? null;
    });
  }

  async function refreshActiveSession(): Promise<void> {
    const state = await getRuntimeSessionState();
    const running = state.runningSession;
    setActiveSession(running);
    setActiveBreaks(
      state.breaks.map((sessionBreak) => ({
        start_time: sessionBreak.start_time,
        end_time: sessionBreak.end_time,
      })),
    );
    setIsPaused(state.paused);

    if (!running) {
      setElapsedSeconds(0);
      return;
    }

    if (running.notes) {
      setNotes(running.notes);
    }

    if (running.client_id) {
      setSelectedClientId(running.client_id);
    }
    if (running.project_id) {
      setSelectedProjectId(running.project_id);
    }
    if (running.task_id) {
      setSelectedTaskId(running.task_id);
    }

    const nowMs = Date.now();
    setElapsedSeconds(computeBillableElapsedSecondsWithBreaks(running, state.breaks, nowMs));
  }

  useEffect(() => {
    initializeDatabase()
      .then(() => refreshClients())
      .then(() => refreshActiveSession())
      .catch((error: unknown) => {
        setMessage(error instanceof Error ? error.message : 'Failed to initialize timer');
      })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    refreshProjects(selectedClientId).catch((error: unknown) => {
      setMessage(error instanceof Error ? error.message : 'Failed to load projects');
    });
  }, [selectedClientId]);

  useEffect(() => {
    refreshTasks(selectedProjectId).catch((error: unknown) => {
      setMessage(error instanceof Error ? error.message : 'Failed to load tasks');
    });
  }, [selectedProjectId]);

  useEffect(() => {
    if (!activeSession || isPaused) {
      return;
    }

    const interval = setInterval(() => {
      const nowMs = Date.now();
      if (activeBreaks.length === 0) {
        setElapsedSeconds(computeBillableElapsedSeconds(activeSession, nowMs));
        return;
      }

      setElapsedSeconds(computeBillableElapsedSecondsWithBreaks(activeSession, activeBreaks, nowMs));
    }, 1000);

    return () => clearInterval(interval);
  }, [activeSession, isPaused, activeBreaks]);

  async function handleCreateClient(): Promise<void> {
    setMessage(null);
    const name = newClientName.trim();
    if (!name) {
      setMessage('Client name is required.');
      return;
    }

    const parsedRate = Number(newClientRate);
    if (!Number.isFinite(parsedRate) || parsedRate < 0) {
      setMessage('Hourly rate must be a non-negative number.');
      return;
    }

    const newId = createId('client');
    await createClient({
      id: newId,
      name,
      email: newClientEmail.trim() ? newClientEmail.trim() : null,
      hourly_rate: parsedRate,
      github_org: newClientGithubOrg.trim() ? newClientGithubOrg.trim() : null,
    });

    await refreshClients();
    setSelectedClientId(newId);
    setIsCreatingClient(false);
    setNewClientName('');
    setNewClientEmail('');
    setNewClientRate('');
    setNewClientGithubOrg('');
  }

  async function handleCreateProject(): Promise<void> {
    setMessage(null);
    if (!selectedClientId) {
      setMessage('Select a client before creating a project.');
      return;
    }

    const name = newProjectName.trim();
    if (!name) {
      setMessage('Project name is required.');
      return;
    }

    const newId = createId('project');
    await createProject({
      id: newId,
      client_id: selectedClientId,
      name,
      github_repo: newProjectGithubRepo.trim() ? newProjectGithubRepo.trim() : null,
    });

    await refreshProjects(selectedClientId);
    setSelectedProjectId(newId);
    setIsCreatingProject(false);
    setNewProjectName('');
    setNewProjectGithubRepo('');
  }

  async function handleCreateTask(): Promise<void> {
    setMessage(null);
    if (!selectedProjectId) {
      setMessage('Select a project before creating a task.');
      return;
    }

    const name = newTaskName.trim();
    if (!name) {
      setMessage('Task name is required.');
      return;
    }

    const newId = createId('task');
    await createTask({
      id: newId,
      project_id: selectedProjectId,
      name,
      github_branch: newTaskGithubBranch.trim() ? newTaskGithubBranch.trim() : null,
    });

    await refreshTasks(selectedProjectId);
    setSelectedTaskId(newId);
    setIsCreatingTask(false);
    setNewTaskName('');
    setNewTaskGithubBranch('');
  }

  async function handleClockIn(): Promise<void> {
    setMessage(null);

    if (!selectedClient || !selectedProject || !selectedTask) {
      setMessage('Select a client, project, and task before clocking in.');
      return;
    }

    try {
      await startRuntimeSession({
        id: createId('session'),
        client: selectedClient.name,
        clientId: selectedClient.id,
        projectId: selectedProject.id,
        taskId: selectedTask.id,
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
      const stoppedId = activeSession.id;
      const currentNotes = activeSession.notes ?? (notes.trim() || null);
      saveLastSelection({
        clientId: selectedClientId,
        projectId: selectedProjectId,
        taskId: selectedTaskId,
      });
      setCompletedSessionId(stoppedId);
      setCompletedSessionNotes(currentNotes);
      setShowCompleteModal(true);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'Failed to clock out.');
    }
  }

  async function handlePause(): Promise<void> {
    if (!activeSession) {
      return;
    }

    setMessage(null);
    try {
      await pauseRuntimeSession(activeSession.id);
      await refreshActiveSession();
      setMessage('Session paused.');
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'Failed to pause session.');
    }
  }

  async function handleResume(): Promise<void> {
    if (!activeSession) {
      return;
    }

    setMessage(null);
    try {
      await resumeRuntimeSession(activeSession.id);
      await refreshActiveSession();
      setMessage('Session resumed.');
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'Failed to resume session.');
    }
  }

  async function handleCreateManualSession(): Promise<void> {
    setMessage(null);

    if (!selectedClient || !selectedProject || !selectedTask) {
      setMessage('Select a client, project, and task before creating a manual session.');
      return;
    }

    if (manualRangeError) {
      setMessage(manualRangeError);
      return;
    }

    const startIso = toIsoFromLocalDateAndTime(manualStartDate, manualStartTime);
    const endIso = toIsoFromLocalDateAndTime(manualEndDate, manualEndTime);

    if (!startIso || !endIso) {
      setMessage('Start and end must be valid date and time values (e.g. 1:30 PM).');
      return;
    }

    try {
      await createRuntimeManualSession({
        id: createId('manual_session'),
        client: selectedClient.name,
        clientId: selectedClient.id,
        projectId: selectedProject.id,
        taskId: selectedTask.id,
        startTimeIso: startIso,
        endTimeIso: endIso,
        notes: manualNotes.trim() ? manualNotes.trim() : null,
      });
      saveLastSelection({
        clientId: selectedClientId,
        projectId: selectedProjectId,
        taskId: selectedTaskId,
      });
      setManualNotes('');
      const resetStart = toLocalDateTimeParts(new Date(Date.now() - 60 * 60 * 1000));
      const resetEnd = toLocalDateTimeParts(new Date());
      setManualStartDate(resetStart.datePart);
      setManualStartTime(resetStart.timePart);
      setManualEndDate(resetEnd.datePart);
      setManualEndTime(resetEnd.timePart);
      setIsCreatingManualSession(false);
      setMessage('Manual session created successfully.');
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : 'Failed to create manual session.');
    }
  }

  async function handleSessionCompleteSave(result: SessionCompleteResult): Promise<void> {
    if (completedSessionId) {
      try {
        await updateSessionNotes({
          id: completedSessionId,
          notes: result.notes,
          commit_sha: result.commitSha,
        });
      } catch {
        // Best effort — session is already stopped, notes update is non-critical
      }
    }

    setShowCompleteModal(false);
    setCompletedSessionId(null);
    setCompletedSessionNotes(null);
    setNotes('');
    await refreshActiveSession();
    setMessage('Clocked out successfully.');
  }

  async function handleSessionCompleteSkip(): Promise<void> {
    setShowCompleteModal(false);
    setCompletedSessionId(null);
    setCompletedSessionNotes(null);
    setNotes('');
    await refreshActiveSession();
    setMessage('Clocked out successfully.');
  }

  async function handleNotesBlur(): Promise<void> {
    if (!activeSession) {
      return;
    }

    const trimmed = notes.trim() || null;
    if (trimmed === (activeSession.notes ?? null)) {
      return;
    }

    try {
      await updateSessionNotes({ id: activeSession.id, notes: trimmed });
    } catch {
      // Best effort save
    }
  }

  return (
    <View className="gap-3 rounded-xl bg-card p-4">
      <Text className="text-xl font-bold text-heading">Timer</Text>
      <Text className="text-muted">
        {isClockedIn ? (isPaused ? 'Currently paused' : 'Currently clocked in') : 'Currently clocked out'}
      </Text>

      <PickerField
        label="Client"
        value={selectedClientId}
        options={clients.map((client) => ({ id: client.id, label: client.name }))}
        placeholder="Select client"
        createValue={CREATE_CLIENT_PICKER_VALUE}
        disabled={isClockedIn || isLoading}
        onSelect={(value) => {
          setSelectedClientId(value);
          setIsCreatingClient(false);
        }}
        onCreateNew={() => {
          setIsCreatingClient(true);
          setIsCreatingProject(false);
          setIsCreatingTask(false);
        }}
      />

      {isCreatingClient && !isClockedIn ? (
        <View className="gap-2 rounded-md border border-border bg-background p-3">
          <TextInput
            value={newClientName}
            onChangeText={setNewClientName}
            placeholder="Client name"
            className="rounded-md border border-border bg-card px-3 py-2 text-foreground"
          />
          <TextInput
            value={newClientEmail}
            onChangeText={setNewClientEmail}
            placeholder="Accounting email (optional)"
            keyboardType="email-address"
            className="rounded-md border border-border bg-card px-3 py-2 text-foreground"
          />
          <TextInput
            value={newClientRate}
            onChangeText={setNewClientRate}
            placeholder="Hourly rate"
            keyboardType="numeric"
            className="rounded-md border border-border bg-card px-3 py-2 text-foreground"
          />
          <TextInput
            value={newClientGithubOrg}
            onChangeText={setNewClientGithubOrg}
            placeholder="GitHub org / owner (optional)"
            autoCapitalize="none"
            autoCorrect={false}
            className="rounded-md border border-border bg-card px-3 py-2 text-foreground"
          />
          <View className="flex-row gap-2">
            <Pressable className="rounded-md bg-secondary px-3 py-2" onPress={() => handleCreateClient()}>
              <Text className="font-semibold text-white">Save Client</Text>
            </Pressable>
            <Pressable
              className="rounded-md border border-border px-3 py-2"
              onPress={() => setIsCreatingClient(false)}
            >
              <Text className="font-semibold text-heading">Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <PickerField
        label="Project"
        value={selectedProjectId}
        options={projects.map((project) => ({ id: project.id, label: project.name }))}
        placeholder="Select project"
        createValue={CREATE_PROJECT_PICKER_VALUE}
        disabled={isClockedIn || isLoading || !selectedClientId}
        onSelect={(value) => {
          setSelectedProjectId(value);
          setIsCreatingProject(false);
        }}
        onCreateNew={() => {
          setIsCreatingProject(true);
          setIsCreatingClient(false);
          setIsCreatingTask(false);
        }}
      />

      {isCreatingProject && !isClockedIn ? (
        <View className="gap-2 rounded-md border border-border bg-background p-3">
          <TextInput
            value={newProjectName}
            onChangeText={setNewProjectName}
            placeholder="Project name"
            className="rounded-md border border-border bg-card px-3 py-2 text-foreground"
          />
          <TextInput
            value={newProjectGithubRepo}
            onChangeText={setNewProjectGithubRepo}
            placeholder="GitHub repo name (optional)"
            autoCapitalize="none"
            autoCorrect={false}
            className="rounded-md border border-border bg-card px-3 py-2 text-foreground"
          />
          <View className="flex-row gap-2">
            <Pressable className="rounded-md bg-secondary px-3 py-2" onPress={() => handleCreateProject()}>
              <Text className="font-semibold text-white">Save Project</Text>
            </Pressable>
            <Pressable
              className="rounded-md border border-border px-3 py-2"
              onPress={() => setIsCreatingProject(false)}
            >
              <Text className="font-semibold text-heading">Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <PickerField
        label="Task"
        value={selectedTaskId}
        options={tasks.map((task) => ({ id: task.id, label: task.name }))}
        placeholder="Select task"
        createValue={CREATE_TASK_PICKER_VALUE}
        disabled={isClockedIn || isLoading || !selectedProjectId}
        onSelect={(value) => {
          setSelectedTaskId(value);
          setIsCreatingTask(false);
        }}
        onCreateNew={() => {
          setIsCreatingTask(true);
          setIsCreatingClient(false);
          setIsCreatingProject(false);
        }}
      />

      {isCreatingTask && !isClockedIn ? (
        <View className="gap-2 rounded-md border border-border bg-background p-3">
          <TextInput
            value={newTaskName}
            onChangeText={setNewTaskName}
            placeholder="Task name"
            className="rounded-md border border-border bg-card px-3 py-2 text-foreground"
          />
          <TextInput
            value={newTaskGithubBranch}
            onChangeText={setNewTaskGithubBranch}
            placeholder="GitHub branch (optional)"
            autoCapitalize="none"
            autoCorrect={false}
            className="rounded-md border border-border bg-card px-3 py-2 text-foreground"
          />
          <View className="flex-row gap-2">
            <Pressable className="rounded-md bg-secondary px-3 py-2" onPress={() => handleCreateTask()}>
              <Text className="font-semibold text-white">Save Task</Text>
            </Pressable>
            <Pressable
              className="rounded-md border border-border px-3 py-2"
              onPress={() => setIsCreatingTask(false)}
            >
              <Text className="font-semibold text-heading">Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <View className="gap-2">
        <Text className="text-xs uppercase tracking-wide text-muted">Session Notes (Optional)</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          onBlur={() => {
            handleNotesBlur().catch(() => undefined);
          }}
          placeholder="What you worked on this session"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
        />
      </View>

      <Text className="text-3xl font-black text-heading">{formatSeconds(elapsedSeconds)}</Text>

      {isClockedIn ? (
        <View className="flex-row gap-2">
          {isPaused ? (
            <Pressable className="flex-1 rounded-2xl bg-secondary px-4 py-3" onPress={handleResume}>
              <View className="flex-row items-center justify-center gap-2">
                <ClockIcon />
                <Text className="text-center font-semibold text-white">Resume</Text>
              </View>
            </Pressable>
          ) : (
            <Pressable className="flex-1 rounded-2xl bg-primary px-4 py-3" onPress={handlePause}>
              <View className="flex-row items-center justify-center gap-2">
                <ClockIcon />
                <Text className="text-center font-semibold text-heading">Pause</Text>
              </View>
            </Pressable>
          )}
          <Pressable className="flex-1 rounded-2xl bg-red-600 px-4 py-3" onPress={handleClockOut}>
            <View className="flex-row items-center justify-center gap-2">
              <ClockIcon />
              <Text className="text-center font-semibold text-white">Clock Out</Text>
            </View>
          </Pressable>
        </View>
      ) : (
        <Pressable
          className="rounded-2xl bg-secondary px-4 py-3"
          onPress={handleClockIn}
          disabled={isLoading}
        >
          <View className="flex-row items-center justify-center gap-2">
            <ClockIcon />
            <Text className="text-center font-semibold text-white">Clock In</Text>
          </View>
        </Pressable>
      )}

      {!isClockedIn ? (
        <Pressable
          className="rounded-2xl border border-border bg-background px-4 py-3"
          onPress={() => setIsCreatingManualSession((open) => !open)}
        >
          <Text className="text-center font-semibold text-heading">
            {isCreatingManualSession ? 'Cancel Manual Session' : 'Create Session'}
          </Text>
        </Pressable>
      ) : null}

      {isCreatingManualSession && !isClockedIn ? (
        <View className="gap-2 rounded-md border border-border bg-background p-3">
          <PickerField
            label="Client"
            value={selectedClientId}
            options={clients.map((client) => ({ id: client.id, label: client.name }))}
            placeholder="Select client"
            createValue={CREATE_CLIENT_PICKER_VALUE}
            onSelect={(value) => {
              setSelectedClientId(value);
              setIsCreatingClient(false);
            }}
            onCreateNew={() => {
              setIsCreatingClient(true);
              setIsCreatingProject(false);
              setIsCreatingTask(false);
            }}
          />
          <PickerField
            label="Project"
            value={selectedProjectId}
            options={projects.map((project) => ({ id: project.id, label: project.name }))}
            placeholder="Select project"
            createValue={CREATE_PROJECT_PICKER_VALUE}
            disabled={!selectedClientId}
            onSelect={(value) => {
              setSelectedProjectId(value);
              setIsCreatingProject(false);
            }}
            onCreateNew={() => {
              setIsCreatingProject(true);
              setIsCreatingClient(false);
              setIsCreatingTask(false);
            }}
          />
          <PickerField
            label="Task"
            value={selectedTaskId}
            options={tasks.map((task) => ({ id: task.id, label: task.name }))}
            placeholder="Select task"
            createValue={CREATE_TASK_PICKER_VALUE}
            disabled={!selectedProjectId}
            onSelect={(value) => {
              setSelectedTaskId(value);
              setIsCreatingTask(false);
            }}
            onCreateNew={() => {
              setIsCreatingTask(true);
              setIsCreatingClient(false);
              setIsCreatingProject(false);
            }}
          />
          <CalendarDateField
            label="Manual session start date"
            value={manualStartDate}
            onChange={setManualStartDate}
          />
          <View className="gap-2">
            <Text className="text-xs uppercase tracking-wide text-muted">Manual session start time</Text>
            <TextInput
              value={manualStartTime}
              onChangeText={setManualStartTime}
              onBlur={() => {
                const normalized = normalizeTimeInput(manualStartTime);
                if (normalized) {
                  setManualStartTime(normalized);
                }
              }}
              placeholder="h:mm AM/PM"
              keyboardType="numbers-and-punctuation"
              className="rounded-md border border-border bg-card px-3 py-2 text-foreground"
            />
          </View>
          <CalendarDateField
            label="Manual session end date"
            value={manualEndDate}
            onChange={setManualEndDate}
          />
          <View className="gap-2">
            <Text className="text-xs uppercase tracking-wide text-muted">Manual session end time</Text>
            <TextInput
              value={manualEndTime}
              onChangeText={setManualEndTime}
              onBlur={() => {
                const normalized = normalizeTimeInput(manualEndTime);
                if (normalized) {
                  setManualEndTime(normalized);
                }
              }}
              placeholder="h:mm AM/PM"
              keyboardType="numbers-and-punctuation"
              className="rounded-md border border-border bg-card px-3 py-2 text-foreground"
            />
          </View>
          {manualRangeError ? <Text className="text-red-600">{manualRangeError}</Text> : null}
          <Text className="text-xs uppercase tracking-wide text-muted">Notes (optional)</Text>
          <TextInput
            value={manualNotes}
            onChangeText={setManualNotes}
            placeholder="What was done in this session"
            className="rounded-md border border-border bg-card px-3 py-2 text-foreground"
          />
          <Pressable
            className={`rounded-md px-4 py-2 ${manualRangeError ? 'bg-secondary/60' : 'bg-secondary'}`}
            onPress={handleCreateManualSession}
            disabled={Boolean(manualRangeError)}
          >
            <Text className="text-center font-semibold text-white">Save Manual Session</Text>
          </Pressable>
        </View>
      ) : null}

      {message ? <Text className="text-sm text-muted">{message}</Text> : null}

      <SessionCompleteModal
        visible={showCompleteModal}
        initialNotes={completedSessionNotes}
        githubOrg={selectedClient?.github_org ?? null}
        githubRepo={selectedProject?.github_repo ?? null}
        githubBranch={selectedTask?.github_branch ?? null}
        onSave={(result: SessionCompleteResult) => {
          handleSessionCompleteSave(result).catch(() => undefined);
        }}
        onSkip={() => {
          handleSessionCompleteSkip().catch(() => undefined);
        }}
      />
    </View>
  );
}
