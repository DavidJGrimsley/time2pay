import { Picker } from '@react-native-picker/picker';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, TextInput, useColorScheme, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp, LinearTransition } from 'react-native-reanimated';
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
import { InlineNotice, type NoticeTone } from '@/components/inline-notice';
import {
  REQUIRED_PROFILE_FIELD_LABELS,
  type RequiredProfileField,
} from '@/services/profile-completion';
import { prettifyBranchName } from '@/services/github';
import { showActionErrorAlert, showBlockedAlert, showValidationAlert } from '@/services/system-alert';

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
  large?: boolean;
  disabled?: boolean;
  onSelect: (value: string | null) => void;
  onCreateNew: () => void;
};

type TimerGateState = {
  locked: boolean;
  missingFields: RequiredProfileField[];
};

export type TimerSelectionHandoff = {
  handoffId: string;
  clientId: string;
  projectId: string;
  taskId: string;
};

type TimerProps = {
  gate?: TimerGateState;
  selectionHandoff?: TimerSelectionHandoff | null;
};

type StatusNotice = {
  text: string;
  tone: NoticeTone;
};

function ClockIcon({ color = '#ffffff', size = 16 }: { color?: string; size?: number }) {
  const stroke = Math.max(2, Math.round(size * 0.12));
  const center = size / 2;
  const minuteHandHeight = Math.max(4, Math.round(size * 0.3));
  const hourHandWidth = Math.max(4, Math.round(size * 0.26));

  return (
    <View style={{ width: size + 6, height: size + 6 }} className="items-center justify-center">
      <View
        style={{
          width: size,
          height: size,
          borderWidth: stroke,
          borderColor: color,
          borderRadius: 999,
          position: 'relative',
        }}
      >
        <View
          style={{
            position: 'absolute',
            left: center - stroke / 2,
            top: stroke,
            width: stroke,
            height: minuteHandHeight,
            borderRadius: 2,
            backgroundColor: color,
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: center - stroke / 2,
            top: center - stroke / 2,
            width: hourHandWidth,
            height: stroke,
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
  large = false,
  disabled = false,
  onSelect,
  onCreateNew,
}: PickerFieldProps) {
  const isDark = useColorScheme() === 'dark';
  const pickerTextColor = isDark ? '#f8f7f3' : '#1a1f16';
  const pickerPlaceholderColor = isDark ? '#b8b7b2' : '#6f7868';
  const pickerSurfaceColor = isDark ? '#1a1f16' : '#f8f7f3';

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
      <Text className={large ? 'text-sm uppercase tracking-wide text-muted' : 'text-xs uppercase tracking-wide text-muted'}>
        {label}
      </Text>
      <View
        className={`rounded-md border border-border bg-background ${large ? 'px-1 py-1' : ''} ${disabled ? 'opacity-60' : ''}`}
      >
        <Picker
          enabled={!disabled}
          selectedValue={value ?? EMPTY_PICKER_VALUE}
          onValueChange={handleValueChange}
          dropdownIconColor={pickerTextColor}
          style={{
            color: pickerTextColor,
            backgroundColor: pickerSurfaceColor,
            fontSize: large ? 24 : 16,
          }}
        >
          <Picker.Item
            label={placeholder}
            value={EMPTY_PICKER_VALUE}
            color={pickerPlaceholderColor}
            style={{ color: pickerPlaceholderColor, backgroundColor: pickerSurfaceColor }}
          />
          {options.map((option) => (
            <Picker.Item
              key={option.id}
              label={option.label}
              value={option.id}
              color={pickerTextColor}
              style={{ color: pickerTextColor, backgroundColor: pickerSurfaceColor }}
            />
          ))}
          <Picker.Item
            label="+ Create new"
            value={createValue}
            color={pickerTextColor}
            style={{ color: pickerTextColor, backgroundColor: pickerSurfaceColor }}
          />
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

export function Timer({ gate, selectionHandoff }: TimerProps) {
  const { width: viewportWidth } = useWindowDimensions();
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
  const [isTaskNameAutoFilled, setIsTaskNameAutoFilled] = useState(false);
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
  const [message, setMessage] = useState<StatusNotice | null>(null);

  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completedSessionId, setCompletedSessionId] = useState<string | null>(null);
  const [completedSessionNotes, setCompletedSessionNotes] = useState<string | null>(null);
  const appliedSelectionHandoffRef = useRef<string | null>(null);

  const isClockedIn = useMemo(() => !!activeSession, [activeSession]);
  const isInteractionLocked = gate?.locked ?? false;
  const lockReason = useMemo(() => {
    const fields = gate?.missingFields ?? [];
    if (fields.length === 0) {
      return 'Complete your profile before using dashboard actions.';
    }

    const labels = fields.map((field) => REQUIRED_PROFILE_FIELD_LABELS[field]);
    return `Complete your profile (${labels.join(', ')}) before using dashboard actions.`;
  }, [gate?.missingFields]);
  const clearMessage = (): void => setMessage(null);
  const showSuccessMessage = (text: string): void => setMessage({ text, tone: 'success' });
  const showInlineErrorMessage = (text: string): void => setMessage({ text, tone: 'error' });
  const showBlockedMessage = (text: string): void => {
    showBlockedAlert(text);
    showInlineErrorMessage(text);
  };
  const showValidationMessage = (text: string): void => {
    showValidationAlert(text);
    showInlineErrorMessage(text);
  };
  const showActionErrorMessage = (text: string): void => {
    showActionErrorAlert(text);
    showInlineErrorMessage(text);
  };
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

  useEffect(() => {
    if (!selectionHandoff) {
      return;
    }

    if (appliedSelectionHandoffRef.current === selectionHandoff.handoffId) {
      return;
    }

    appliedSelectionHandoffRef.current = selectionHandoff.handoffId;
    let cancelled = false;

    (async () => {
      try {
        const clientRows = await listClients();
        if (cancelled) {
          return;
        }

        setClients(clientRows);
        const nextClientId = clientRows.some((client) => client.id === selectionHandoff.clientId)
          ? selectionHandoff.clientId
          : (clientRows[0]?.id ?? null);
        setSelectedClientId(nextClientId);

        if (!nextClientId) {
          setProjects([]);
          setTasks([]);
          setSelectedProjectId(null);
          setSelectedTaskId(null);
          saveLastSelection({
            clientId: null,
            projectId: null,
            taskId: null,
          });
          return;
        }

        const projectRows = await listProjectsByClient(nextClientId);
        if (cancelled) {
          return;
        }

        setProjects(projectRows);
        const nextProjectId = projectRows.some((project) => project.id === selectionHandoff.projectId)
          ? selectionHandoff.projectId
          : (projectRows[0]?.id ?? null);
        setSelectedProjectId(nextProjectId);

        if (!nextProjectId) {
          setTasks([]);
          setSelectedTaskId(null);
          saveLastSelection({
            clientId: nextClientId,
            projectId: null,
            taskId: null,
          });
          return;
        }

        const taskRows = await listTasksByProject(nextProjectId);
        if (cancelled) {
          return;
        }

        setTasks(taskRows);
        const nextTaskId = taskRows.some((task) => task.id === selectionHandoff.taskId)
          ? selectionHandoff.taskId
          : (taskRows[0]?.id ?? null);
        setSelectedTaskId(nextTaskId);
        saveLastSelection({
          clientId: nextClientId,
          projectId: nextProjectId,
          taskId: nextTaskId,
        });
      } catch (error: unknown) {
        if (cancelled) {
          return;
        }
        showInlineErrorMessage(
          error instanceof Error ? error.message : 'Failed to apply GitHub selection.',
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectionHandoff]);

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
        showInlineErrorMessage(error instanceof Error ? error.message : 'Failed to initialize timer');
      })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    refreshProjects(selectedClientId).catch((error: unknown) => {
      showInlineErrorMessage(error instanceof Error ? error.message : 'Failed to load projects');
    });
  }, [selectedClientId]);

  useEffect(() => {
    refreshTasks(selectedProjectId).catch((error: unknown) => {
      showInlineErrorMessage(error instanceof Error ? error.message : 'Failed to load tasks');
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

  useEffect(() => {
    if (!isInteractionLocked || isClockedIn) {
      return;
    }

    setIsCreatingClient(false);
    setIsCreatingProject(false);
    setIsCreatingTask(false);
    setIsCreatingManualSession(false);
    setIsTaskNameAutoFilled(false);
  }, [isClockedIn, isInteractionLocked]);

  async function handleCreateClient(): Promise<void> {
    clearMessage();
    if (isInteractionLocked) {
      showBlockedMessage(lockReason);
      return;
    }

    const name = newClientName.trim();
    if (!name) {
      showValidationMessage('Client name is required.');
      return;
    }

    const parsedRate = Number(newClientRate);
    if (!Number.isFinite(parsedRate) || parsedRate < 0) {
      showValidationMessage('Hourly rate must be a non-negative number.');
      return;
    }

    try {
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
      showSuccessMessage('Client created successfully.');
    } catch (error: unknown) {
      showActionErrorMessage(error instanceof Error ? error.message : 'Failed to create client.');
    }
  }

  async function handleCreateProject(): Promise<void> {
    clearMessage();
    if (isInteractionLocked) {
      showBlockedMessage(lockReason);
      return;
    }

    if (!selectedClientId) {
      showValidationMessage('Select a client before creating a project.');
      return;
    }

    const name = newProjectName.trim();
    if (!name) {
      showValidationMessage('Project name is required.');
      return;
    }

    try {
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
      showSuccessMessage('Project created successfully.');
    } catch (error: unknown) {
      showActionErrorMessage(error instanceof Error ? error.message : 'Failed to create project.');
    }
  }

  async function handleCreateTask(): Promise<void> {
    clearMessage();
    if (isInteractionLocked) {
      showBlockedMessage(lockReason);
      return;
    }

    if (!selectedProjectId) {
      showValidationMessage('Select a project before creating a task.');
      return;
    }

    const name = newTaskName.trim();
    if (!name) {
      showValidationMessage('Task name is required.');
      return;
    }

    try {
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
      setIsTaskNameAutoFilled(false);
      showSuccessMessage('Task created successfully.');
    } catch (error: unknown) {
      showActionErrorMessage(error instanceof Error ? error.message : 'Failed to create task.');
    }
  }

  async function handleClockIn(): Promise<void> {
    clearMessage();
    if (isInteractionLocked) {
      showBlockedMessage(lockReason);
      return;
    }

    if (!selectedClient || !selectedProject || !selectedTask) {
      showValidationMessage('Select a client, project, and task before clocking in.');
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
      showSuccessMessage('Clocked in successfully.');
    } catch (error: unknown) {
      showActionErrorMessage(error instanceof Error ? error.message : 'Failed to clock in.');
    }
  }

  async function handleClockOut(): Promise<void> {
    if (!activeSession) {
      return;
    }

    clearMessage();

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
      showActionErrorMessage(error instanceof Error ? error.message : 'Failed to clock out.');
    }
  }

  async function handlePause(): Promise<void> {
    if (!activeSession) {
      return;
    }

    clearMessage();
    try {
      await pauseRuntimeSession(activeSession.id);
      await refreshActiveSession();
      showSuccessMessage('Session paused.');
    } catch (error: unknown) {
      showActionErrorMessage(error instanceof Error ? error.message : 'Failed to pause session.');
    }
  }

  async function handleResume(): Promise<void> {
    if (!activeSession) {
      return;
    }

    clearMessage();
    try {
      await resumeRuntimeSession(activeSession.id);
      await refreshActiveSession();
      showSuccessMessage('Session resumed.');
    } catch (error: unknown) {
      showActionErrorMessage(error instanceof Error ? error.message : 'Failed to resume session.');
    }
  }

  async function handleCreateManualSession(): Promise<void> {
    clearMessage();
    if (isInteractionLocked) {
      showBlockedMessage(lockReason);
      return;
    }

    if (!selectedClient || !selectedProject || !selectedTask) {
      showValidationMessage('Select a client, project, and task before creating a manual session.');
      return;
    }

    if (manualRangeError) {
      showValidationMessage(manualRangeError);
      return;
    }

    const startIso = toIsoFromLocalDateAndTime(manualStartDate, manualStartTime);
    const endIso = toIsoFromLocalDateAndTime(manualEndDate, manualEndTime);

    if (!startIso || !endIso) {
      showValidationMessage('Start and end must be valid date and time values (e.g. 1:30 PM).');
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
      showSuccessMessage('Manual session created successfully.');
    } catch (error: unknown) {
      showActionErrorMessage(error instanceof Error ? error.message : 'Failed to create manual session.');
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
    showSuccessMessage('Clocked out successfully.');
  }

  async function handleSessionCompleteSkip(): Promise<void> {
    setShowCompleteModal(false);
    setCompletedSessionId(null);
    setCompletedSessionNotes(null);
    setNotes('');
    await refreshActiveSession();
    showSuccessMessage('Clocked out successfully.');
  }

  async function handleNotesBlur(): Promise<void> {
    if (!activeSession || isInteractionLocked) {
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

  const isLargeScreen = viewportWidth >= 1200;
  const isTablet = viewportWidth >= 768 && viewportWidth < 1200;
  const containerWidthStyle = isLargeScreen
    ? { width: '90%' as const, maxWidth: 1500 }
    : isTablet
      ? { width: '75%' as const }
      : { width: '90%' as const };
  const smoothLayout = LinearTransition.springify().damping(20).stiffness(170);
  const timerValueClassName = isLargeScreen
    ? 'text-center text-7xl font-black text-heading'
    : 'text-3xl font-black text-heading';
  const actionButtonPaddingClassName = isLargeScreen ? 'px-8 py-7' : 'px-4 py-3';
  const actionButtonLabelClassName = isLargeScreen
    ? 'text-center text-3xl font-semibold'
    : 'text-center font-semibold';
  const actionIconSize = isLargeScreen ? 28 : 16;
  const timerContainerClassName = isLargeScreen ? 'gap-4 rounded-xl bg-card p-6' : 'gap-3 rounded-xl bg-card p-4';
  const timerTitleClassName = isLargeScreen ? 'text-3xl font-bold text-heading' : 'text-xl font-bold text-heading';
  const timerStatusClassName = isLargeScreen ? 'text-lg text-muted' : 'text-muted';
  const notesInputClassName = isLargeScreen
    ? `rounded-md border border-border bg-background px-4 py-4 text-xl text-foreground ${isInteractionLocked ? 'opacity-60' : ''}`
    : `rounded-md border border-border bg-background px-3 py-2 text-foreground ${isInteractionLocked ? 'opacity-60' : ''}`;
  const createSessionButtonClassName = isLargeScreen
    ? `rounded-2xl border border-border bg-background px-8 py-5 ${isInteractionLocked ? 'opacity-60' : ''}`
    : `rounded-2xl border border-border bg-background px-4 py-3 ${isInteractionLocked ? 'opacity-60' : ''}`;
  const createSessionTextClassName = isLargeScreen
    ? 'text-center text-2xl font-semibold text-heading'
    : 'text-center font-semibold text-heading';

  return (
    <Animated.View className="items-center" layout={smoothLayout}>
      <Animated.View className={timerContainerClassName} style={containerWidthStyle} layout={smoothLayout}>
      <Text className={timerTitleClassName}>Timer</Text>
      <Text className={timerStatusClassName}>
        {isClockedIn ? (isPaused ? 'Currently paused' : 'Currently clocked in') : 'Currently clocked out'}
      </Text>
      <Animated.View
        className="gap-3"
        layout={smoothLayout}
        style={isLargeScreen ? { flexDirection: 'row', alignItems: 'stretch', gap: 16 } : undefined}
      >
        <Animated.View className="gap-3" layout={smoothLayout} style={isLargeScreen ? { flex: 1 } : undefined}>
          <PickerField
            label="Client"
            value={selectedClientId}
            options={clients.map((client) => ({ id: client.id, label: client.name }))}
            placeholder="Select client"
            createValue={CREATE_CLIENT_PICKER_VALUE}
            large={isLargeScreen}
            disabled={isClockedIn || isLoading || isInteractionLocked}
            onSelect={(value) => {
              if (isInteractionLocked) {
                showBlockedMessage(lockReason);
                return;
              }
              setSelectedClientId(value);
              setIsCreatingClient(false);
            }}
            onCreateNew={() => {
              if (isInteractionLocked) {
                showBlockedMessage(lockReason);
                return;
              }
              setIsCreatingClient(true);
              setIsCreatingProject(false);
              setIsCreatingTask(false);
            }}
          />

      {isCreatingClient && !isClockedIn && !isInteractionLocked ? (
        <Animated.View
          className="gap-2 rounded-md border border-border bg-background p-3"
          entering={FadeInDown.duration(180)}
          exiting={FadeOutUp.duration(160)}
          layout={smoothLayout}
        >
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
        </Animated.View>
      ) : null}

      <PickerField
        label="Project"
        value={selectedProjectId}
        options={projects.map((project) => ({ id: project.id, label: project.name }))}
        placeholder="Select project"
        createValue={CREATE_PROJECT_PICKER_VALUE}
        large={isLargeScreen}
        disabled={isClockedIn || isLoading || isInteractionLocked || !selectedClientId}
        onSelect={(value) => {
          if (isInteractionLocked) {
            showBlockedMessage(lockReason);
            return;
          }
          setSelectedProjectId(value);
          setIsCreatingProject(false);
        }}
        onCreateNew={() => {
          if (isInteractionLocked) {
            showBlockedMessage(lockReason);
            return;
          }
          setIsCreatingProject(true);
          setIsCreatingClient(false);
          setIsCreatingTask(false);
        }}
      />

      {isCreatingProject && !isClockedIn && !isInteractionLocked ? (
        <Animated.View
          className="gap-2 rounded-md border border-border bg-background p-3"
          entering={FadeInDown.duration(180)}
          exiting={FadeOutUp.duration(160)}
          layout={smoothLayout}
        >
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
        </Animated.View>
      ) : null}

      <PickerField
        label="Task"
        value={selectedTaskId}
        options={tasks.map((task) => ({ id: task.id, label: task.name }))}
        placeholder="Select task"
        createValue={CREATE_TASK_PICKER_VALUE}
        large={isLargeScreen}
        disabled={isClockedIn || isLoading || isInteractionLocked || !selectedProjectId}
        onSelect={(value) => {
          if (isInteractionLocked) {
            showBlockedMessage(lockReason);
            return;
          }
          setSelectedTaskId(value);
          setIsCreatingTask(false);
        }}
        onCreateNew={() => {
          if (isInteractionLocked) {
            showBlockedMessage(lockReason);
            return;
          }
          setIsCreatingTask(true);
          setIsCreatingClient(false);
          setIsCreatingProject(false);
          setIsTaskNameAutoFilled(false);
        }}
      />

      {isCreatingTask && !isClockedIn && !isInteractionLocked ? (
        <Animated.View
          className="gap-2 rounded-md border border-border bg-background p-3"
          entering={FadeInDown.duration(180)}
          exiting={FadeOutUp.duration(160)}
          layout={smoothLayout}
        >
          <TextInput
            value={newTaskName}
            onChangeText={(value) => {
              setNewTaskName(value);
              setIsTaskNameAutoFilled(false);
            }}
            placeholder="Task name"
            className="rounded-md border border-border bg-card px-3 py-2 text-foreground"
          />
          {isTaskNameAutoFilled ? (
            <Text className="text-xs text-muted">Auto-filled from branch name.</Text>
          ) : null}
          <TextInput
            value={newTaskGithubBranch}
            onChangeText={(value) => {
              setNewTaskGithubBranch(value);
              if (!newTaskName.trim()) {
                const prettyName = prettifyBranchName(value);
                if (prettyName) {
                  setNewTaskName(prettyName);
                  setIsTaskNameAutoFilled(true);
                }
              }
            }}
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
              onPress={() => {
                setIsCreatingTask(false);
                setIsTaskNameAutoFilled(false);
              }}
            >
              <Text className="font-semibold text-heading">Cancel</Text>
            </Pressable>
          </View>
        </Animated.View>
      ) : null}

      <View className="gap-2">
        <Text className={isLargeScreen ? 'text-sm uppercase tracking-wide text-muted' : 'text-xs uppercase tracking-wide text-muted'}>
          Session Notes (Optional)
        </Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          editable={!isInteractionLocked}
          onBlur={() => {
            handleNotesBlur().catch(() => undefined);
          }}
          placeholder="What you worked on this session"
          className={notesInputClassName}
        />
      </View>
        </Animated.View>

        <Animated.View
          className={`gap-4 ${isLargeScreen ? 'rounded-xl border border-border bg-background p-4' : ''}`}
          layout={smoothLayout}
          style={isLargeScreen ? { flex: 1, justifyContent: 'space-between' } : undefined}
        >
          <Text className={timerValueClassName}>{formatSeconds(elapsedSeconds)}</Text>

      {isClockedIn ? (
        <View className="flex-row gap-2">
          {isPaused ? (
            <Pressable className={`flex-1 rounded-2xl bg-secondary ${actionButtonPaddingClassName}`} onPress={handleResume}>
              <View className="flex-row items-center justify-center gap-2">
                <ClockIcon size={actionIconSize} />
                <Text className={`${actionButtonLabelClassName} text-white`}>Resume</Text>
              </View>
            </Pressable>
          ) : (
            <Pressable className={`flex-1 rounded-2xl bg-primary ${actionButtonPaddingClassName}`} onPress={handlePause}>
              <View className="flex-row items-center justify-center gap-2">
                <ClockIcon size={actionIconSize} />
                <Text className={`${actionButtonLabelClassName} text-heading`}>Pause</Text>
              </View>
            </Pressable>
          )}
          <Pressable className={`flex-1 rounded-2xl bg-danger ${actionButtonPaddingClassName}`} onPress={handleClockOut}>
            <View className="flex-row items-center justify-center gap-2">
              <ClockIcon size={actionIconSize} />
              <Text className={`${actionButtonLabelClassName} text-white`}>Clock Out</Text>
            </View>
          </Pressable>
        </View>
      ) : (
        <Pressable
          className={`rounded-2xl ${actionButtonPaddingClassName} ${isInteractionLocked || isLoading ? 'bg-secondary/60' : 'bg-secondary'}`}
          onPress={handleClockIn}
          disabled={isLoading || isInteractionLocked}
        >
          <View className="flex-row items-center justify-center gap-2">
            <ClockIcon size={actionIconSize} />
            <Text className={`${actionButtonLabelClassName} text-white`}>Clock In</Text>
          </View>
        </Pressable>
      )}
        </Animated.View>
      </Animated.View>

      {!isClockedIn ? (
        <View className="items-center">
          <Pressable
            className={createSessionButtonClassName}
            style={isLargeScreen ? { width: '40%', minWidth: 320 } : undefined}
            onPress={() => {
              if (isInteractionLocked) {
                showBlockedMessage(lockReason);
                return;
              }

              setIsCreatingManualSession((open) => !open);
            }}
            disabled={isInteractionLocked}
          >
            <Text className={createSessionTextClassName}>
              {isCreatingManualSession ? 'Cancel Manual Session' : 'Create Session'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {isCreatingManualSession && !isClockedIn && !isInteractionLocked ? (
        <Animated.View
          className="gap-2 rounded-md border border-border bg-background p-3"
          entering={FadeInDown.duration(180)}
          exiting={FadeOutUp.duration(160)}
          layout={smoothLayout}
        >
          <PickerField
            label="Client"
            value={selectedClientId}
            options={clients.map((client) => ({ id: client.id, label: client.name }))}
            placeholder="Select client"
            createValue={CREATE_CLIENT_PICKER_VALUE}
            large={isLargeScreen}
            disabled={isInteractionLocked}
            onSelect={(value) => {
              if (isInteractionLocked) {
                showBlockedMessage(lockReason);
                return;
              }
              setSelectedClientId(value);
              setIsCreatingClient(false);
            }}
            onCreateNew={() => {
              if (isInteractionLocked) {
                showBlockedMessage(lockReason);
                return;
              }
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
            large={isLargeScreen}
            disabled={isInteractionLocked || !selectedClientId}
            onSelect={(value) => {
              if (isInteractionLocked) {
                showBlockedMessage(lockReason);
                return;
              }
              setSelectedProjectId(value);
              setIsCreatingProject(false);
            }}
            onCreateNew={() => {
              if (isInteractionLocked) {
                showBlockedMessage(lockReason);
                return;
              }
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
            large={isLargeScreen}
            disabled={isInteractionLocked || !selectedProjectId}
            onSelect={(value) => {
              if (isInteractionLocked) {
                showBlockedMessage(lockReason);
                return;
              }
              setSelectedTaskId(value);
              setIsCreatingTask(false);
            }}
            onCreateNew={() => {
              if (isInteractionLocked) {
                showBlockedMessage(lockReason);
                return;
              }
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
              editable={!isInteractionLocked}
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
              editable={!isInteractionLocked}
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
          {manualRangeError ? <InlineNotice tone="error" message={manualRangeError} /> : null}
          <Text className="text-xs uppercase tracking-wide text-muted">Notes (optional)</Text>
          <TextInput
            value={manualNotes}
            onChangeText={setManualNotes}
            editable={!isInteractionLocked}
            placeholder="What was done in this session"
            className="rounded-md border border-border bg-card px-3 py-2 text-foreground"
          />
          <Pressable
            className={`rounded-md px-4 py-2 ${manualRangeError || isInteractionLocked ? 'bg-secondary/60' : 'bg-secondary'}`}
            onPress={handleCreateManualSession}
            disabled={Boolean(manualRangeError) || isInteractionLocked}
          >
            <Text className="text-center font-semibold text-white">Save Manual Session</Text>
          </Pressable>
        </Animated.View>
      ) : null}

      {message ? (
        <Animated.View entering={FadeInDown.duration(180)} exiting={FadeOutUp.duration(160)} layout={smoothLayout}>
          <InlineNotice tone={message.tone} message={message.text} />
        </Animated.View>
      ) : null}

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
      </Animated.View>
    </Animated.View>
  );
}
