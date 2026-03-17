import { Picker } from '@react-native-picker/picker';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, useColorScheme, useWindowDimensions, View } from 'react-native';
import {
  createProject,
  createTask,
  initializeDatabase,
  listClients,
  listProjectsByClient,
  listTasksByProject,
  type Client,
  type Project,
  type Session,
  type Task,
} from '@/database/db';
import { createTime2PayClient } from '@/services/client-sync';
import { CalendarDateField } from '@/components/calendar-date-field';
import { GitHubCommitBadge } from '@/components/github-commit-badge';
import { InlineNotice, type NoticeTone } from '@/components/inline-notice';
import { prettifyBranchName } from '@/services/github';
import { listRuntimeSessions, updateRuntimeSession } from '@/services/session-runtime';
import { showActionErrorAlert, showBlockedAlert, showValidationAlert } from '@/services/system-alert';

const EMPTY_PICKER_VALUE = '';
const CREATE_CLIENT_PICKER_VALUE = '__create_client__';
const CREATE_PROJECT_PICKER_VALUE = '__create_project__';
const CREATE_TASK_PICKER_VALUE = '__create_task__';

type Option = {
  id: string;
  label: string;
};

type WeekGroup = {
  key: string;
  label: string;
  sessions: Session[];
};

type StatusNotice = {
  message: string;
  tone: NoticeTone;
};

type SelectFieldProps = {
  label?: string;
  value: string | null;
  options: Option[];
  placeholder: string;
  createValue?: string;
  disabled?: boolean;
  hideLabel?: boolean;
  onSelect: (value: string | null) => void;
  onCreateNew?: () => void;
};

function SelectField({
  label = '',
  value,
  options,
  placeholder,
  createValue,
  disabled = false,
  hideLabel = false,
  onSelect,
  onCreateNew,
}: SelectFieldProps) {
  const isDark = useColorScheme() === 'dark';
  const pickerTextColor = isDark ? '#f8f7f3' : '#1a1f16';
  const pickerPlaceholderColor = isDark ? '#b8b7b2' : '#6f7868';
  const pickerSurfaceColor = isDark ? '#1a1f16' : '#f8f7f3';

  function handleValueChange(itemValue: string | number): void {
    const next = String(itemValue ?? EMPTY_PICKER_VALUE);
    if (createValue && onCreateNew && next === createValue) {
      onCreateNew();
      return;
    }

    onSelect(next || null);
  }

  return (
    <View className="gap-2">
      {!hideLabel ? <Text className="text-xs uppercase tracking-wide text-muted">{label}</Text> : null}
      <View className={`rounded-md border border-border bg-background ${disabled ? 'opacity-60' : ''}`}>
        <Picker
          enabled={!disabled}
          selectedValue={value ?? EMPTY_PICKER_VALUE}
          onValueChange={handleValueChange}
          dropdownIconColor={pickerTextColor}
          style={{ color: pickerTextColor, backgroundColor: pickerSurfaceColor }}
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
          {createValue ? (
            <Picker.Item
              label="+ Create new"
              value={createValue}
              color={pickerTextColor}
              style={{ color: pickerTextColor, backgroundColor: pickerSurfaceColor }}
            />
          ) : null}
        </Picker>
      </View>
    </View>
  );
}

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

function startOfWeekMonday(date: Date): Date {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() + diff);
  return copy;
}

function endOfWeekSunday(startMonday: Date): Date {
  const copy = new Date(startMonday);
  copy.setDate(copy.getDate() + 6);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function isoDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
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

function toLocalDateTimeParts(iso: string): { datePart: string; timePart: string } {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    const fallback = new Date();
    return {
      datePart: toLocalDatePart(fallback),
      timePart: toLocalTimePart(fallback),
    };
  }

  return {
    datePart: toLocalDatePart(parsed),
    timePart: toLocalTimePart(parsed),
  };
}

function combineLocalDateAndTime(datePart: string, timePart: string): string | null {
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

function createId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function SessionList() {
  const { width } = useWindowDimensions();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedClientFilterId, setSelectedClientFilterId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusNotice | null>(null);

  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [editClientId, setEditClientId] = useState<string | null>(null);
  const [editProjectId, setEditProjectId] = useState<string | null>(null);
  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const [editStartDate, setEditStartDate] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [isCreatingEditClient, setIsCreatingEditClient] = useState(false);
  const [isCreatingEditProject, setIsCreatingEditProject] = useState(false);
  const [isCreatingEditTask, setIsCreatingEditTask] = useState(false);
  const [newEditClientName, setNewEditClientName] = useState('');
  const [newEditClientEmail, setNewEditClientEmail] = useState('');
  const [newEditClientRate, setNewEditClientRate] = useState('');
  const [newEditClientGithubOrg, setNewEditClientGithubOrg] = useState('');
  const [newEditProjectName, setNewEditProjectName] = useState('');
  const [newEditProjectGithubRepo, setNewEditProjectGithubRepo] = useState('');
  const [newEditTaskName, setNewEditTaskName] = useState('');
  const [newEditTaskGithubBranch, setNewEditTaskGithubBranch] = useState('');
  const [isEditTaskNameAutoFilled, setIsEditTaskNameAutoFilled] = useState(false);
  const isLargeScreen = width >= 1200;
  const isTablet = width >= 768 && width < 1200;
  const contentWidthStyle = isLargeScreen
    ? { width: '90%' as const, maxWidth: 1500 }
    : isTablet
      ? { width: '75%' as const }
      : { width: '90%' as const };

  const load = useCallback(async () => {
    setError(null);
    setStatus(null);
    setIsLoading(true);

    try {
      await initializeDatabase();
      const [sessionRows, clientRows] = await Promise.all([listRuntimeSessions(), listClients()]);
      setSessions(sessionRows.filter((session) => session.deleted_at === null));
      setClients(clientRows);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load sessions');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  useEffect(() => {
    if (!editingSession) {
      return;
    }

    if (!editClientId) {
      setProjects([]);
      setEditProjectId(null);
      return;
    }

    listProjectsByClient(editClientId)
      .then((projectRows) => {
        setProjects(projectRows);
        setEditProjectId((current) => {
          if (current && projectRows.some((project) => project.id === current)) {
            return current;
          }
          return projectRows[0]?.id ?? null;
        });
      })
      .catch((projectError: unknown) => {
        setEditError(projectError instanceof Error ? projectError.message : 'Failed to load projects');
      });
  }, [editingSession, editClientId]);

  useEffect(() => {
    if (!editingSession) {
      return;
    }

    if (!editProjectId) {
      setTasks([]);
      setEditTaskId(null);
      return;
    }

    listTasksByProject(editProjectId)
      .then((taskRows) => {
        setTasks(taskRows);
        setEditTaskId((current) => {
          if (current && taskRows.some((task) => task.id === current)) {
            return current;
          }
          return taskRows[0]?.id ?? null;
        });
      })
      .catch((taskError: unknown) => {
        setEditError(taskError instanceof Error ? taskError.message : 'Failed to load tasks');
      });
  }, [editingSession, editProjectId]);

  const editRangeError = useMemo(() => {
    if (!editingSession) {
      return null;
    }

    const startIso = combineLocalDateAndTime(editStartDate, editStartTime);
    const endIso = combineLocalDateAndTime(editEndDate, editEndTime);
    if (!startIso || !endIso) {
      return 'Use valid start/end date and time (e.g. 1:30 PM).';
    }

    if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
      return 'End time must be after start time.';
    }

    return null;
  }, [editingSession, editStartDate, editStartTime, editEndDate, editEndTime]);

  const filteredSessions = useMemo(() => {
    if (!selectedClientFilterId) {
      return sessions;
    }

    return sessions.filter((session) => session.client_id === selectedClientFilterId);
  }, [sessions, selectedClientFilterId]);

  const groupedWeeks = useMemo<WeekGroup[]>(() => {
    const weekMap = new Map<string, WeekGroup>();

    for (const session of filteredSessions) {
      const sessionDate = new Date(session.start_time);
      if (Number.isNaN(sessionDate.getTime())) {
        continue;
      }

      const monday = startOfWeekMonday(sessionDate);
      const sunday = endOfWeekSunday(monday);
      const key = isoDateOnly(monday);

      const existing = weekMap.get(key);
      if (existing) {
        existing.sessions.push(session);
        continue;
      }

      weekMap.set(key, {
        key,
        label: `${monday.toLocaleDateString()} - ${sunday.toLocaleDateString()}`,
        sessions: [session],
      });
    }

    return Array.from(weekMap.values())
      .map((group) => ({
        ...group,
        sessions: [...group.sessions].sort((a, b) => (a.start_time < b.start_time ? 1 : -1)),
      }))
      .sort((a, b) => (a.key < b.key ? 1 : -1));
  }, [filteredSessions]);

  function closeEditModal(): void {
    setEditingSession(null);
    setEditError(null);
    setProjects([]);
    setTasks([]);
    setIsCreatingEditClient(false);
    setIsCreatingEditProject(false);
    setIsCreatingEditTask(false);
    setIsEditTaskNameAutoFilled(false);
  }

  function openEditModal(session: Session): void {
    setError(null);
    setStatus(null);

    if (session.invoice_id) {
      const message = 'Invoiced sessions are locked and cannot be edited.';
      showBlockedAlert(message);
      setStatus({ message, tone: 'error' });
      return;
    }

    if (!session.end_time) {
      const message = 'Only completed sessions can be edited.';
      showBlockedAlert(message);
      setStatus({ message, tone: 'error' });
      return;
    }

    const startParts = toLocalDateTimeParts(session.start_time);
    const endParts = toLocalDateTimeParts(session.end_time);
    setEditingSession(session);
    setEditClientId(session.client_id);
    setEditProjectId(session.project_id);
    setEditTaskId(session.task_id);
    setEditStartDate(startParts.datePart);
    setEditStartTime(startParts.timePart);
    setEditEndDate(endParts.datePart);
    setEditEndTime(endParts.timePart);
    setEditNotes(session.notes ?? '');
    setEditError(null);
    setIsCreatingEditClient(false);
    setIsCreatingEditProject(false);
    setIsCreatingEditTask(false);
    setIsEditTaskNameAutoFilled(false);
  }

  async function handleCreateEditClient(): Promise<void> {
    setEditError(null);
    const name = newEditClientName.trim();
    if (!name) {
      const message = 'Customer name is required.';
      showValidationAlert(message);
      setEditError(message);
      return;
    }

    const email = newEditClientEmail.trim();
    if (!email) {
      const message = 'Customer email is required.';
      showValidationAlert(message);
      setEditError(message);
      return;
    }

    const parsedRate = Number(newEditClientRate || '0');
    if (!Number.isFinite(parsedRate) || parsedRate < 0) {
      const message = 'Hourly rate must be a non-negative number.';
      showValidationAlert(message);
      setEditError(message);
      return;
    }

    const newId = createId('client');
    await createTime2PayClient({
      id: newId,
      name,
      email,
      hourly_rate: parsedRate,
      github_org: newEditClientGithubOrg.trim() ? newEditClientGithubOrg.trim() : null,
    });

    const clientRows = await listClients();
    setClients(clientRows);
    setEditClientId(newId);
    setIsCreatingEditClient(false);
    setNewEditClientName('');
    setNewEditClientEmail('');
    setNewEditClientRate('');
    setNewEditClientGithubOrg('');
  }

  async function handleCreateEditProject(): Promise<void> {
    setEditError(null);
    if (!editClientId) {
      const message = 'Select a customer before creating a project.';
      showValidationAlert(message);
      setEditError(message);
      return;
    }

    const name = newEditProjectName.trim();
    if (!name) {
      const message = 'Project name is required.';
      showValidationAlert(message);
      setEditError(message);
      return;
    }

    const newId = createId('project');
    await createProject({
      id: newId,
      client_id: editClientId,
      name,
      github_repo: newEditProjectGithubRepo.trim() ? newEditProjectGithubRepo.trim() : null,
    });

    const projectRows = await listProjectsByClient(editClientId);
    setProjects(projectRows);
    setEditProjectId(newId);
    setIsCreatingEditProject(false);
    setNewEditProjectName('');
    setNewEditProjectGithubRepo('');
  }

  async function handleCreateEditTask(): Promise<void> {
    setEditError(null);
    if (!editProjectId) {
      const message = 'Select a project before creating a task.';
      showValidationAlert(message);
      setEditError(message);
      return;
    }

    const name = newEditTaskName.trim();
    if (!name) {
      const message = 'Task name is required.';
      showValidationAlert(message);
      setEditError(message);
      return;
    }

    const newId = createId('task');
    await createTask({
      id: newId,
      project_id: editProjectId,
      name,
      github_branch: newEditTaskGithubBranch.trim() ? newEditTaskGithubBranch.trim() : null,
    });

    const taskRows = await listTasksByProject(editProjectId);
    setTasks(taskRows);
    setEditTaskId(newId);
    setIsCreatingEditTask(false);
    setNewEditTaskName('');
    setNewEditTaskGithubBranch('');
    setIsEditTaskNameAutoFilled(false);
  }

  async function handleSaveEdit(): Promise<void> {
    if (!editingSession) {
      return;
    }

    setEditError(null);

    if (!editClientId || !editProjectId || !editTaskId) {
      const message = 'Customer, project, and task are required.';
      showValidationAlert(message);
      setEditError(message);
      return;
    }

    if (editRangeError) {
      showValidationAlert(editRangeError);
      setEditError(editRangeError);
      return;
    }

    const startIso = combineLocalDateAndTime(editStartDate, editStartTime);
    const endIso = combineLocalDateAndTime(editEndDate, editEndTime);
    if (!startIso || !endIso) {
      const message = 'Start and end must be valid date and time values (e.g. 1:30 PM).';
      showValidationAlert(message);
      setEditError(message);
      return;
    }

    setIsSavingEdit(true);

    try {
      await updateRuntimeSession({
        id: editingSession.id,
        clientId: editClientId,
        projectId: editProjectId,
        taskId: editTaskId,
        startTimeIso: startIso,
        endTimeIso: endIso,
        notes: editNotes.trim() ? editNotes.trim() : null,
      });
      closeEditModal();
      await load();
      setStatus({ message: 'Session updated successfully.', tone: 'success' });
    } catch (saveError: unknown) {
      const message = saveError instanceof Error ? saveError.message : 'Failed to update session.';
      showActionErrorAlert(message);
      setEditError(message);
    } finally {
      setIsSavingEdit(false);
    }
  }

  return (
    <View className="gap-4">
      <View className="gap-2">
        <View className="flex-row items-start justify-between gap-4">
          <Text className="text-3xl font-extrabold text-heading">Sessions</Text>
          <View className="w-52">
            <SelectField
              hideLabel
              value={selectedClientFilterId}
              options={clients.map((client) => ({ id: client.id, label: client.name }))}
              placeholder="All customers"
              onSelect={(value) => setSelectedClientFilterId(value)}
            />
          </View>
        </View>
        <View className="flex-1">
          <Text className="text-muted">Track and review your logged work sessions.</Text>
        </View>
      </View>
      <View className="items-center">
        <View className="w-full gap-4" style={contentWidthStyle}>

          {isLoading ? <Text className="text-muted">Loading sessions...</Text> : null}
          {error ? <InlineNotice tone="error" message={error} /> : null}
          {status ? <InlineNotice tone={status.tone} message={status.message} /> : null}

          {!isLoading && groupedWeeks.length === 0 ? (
            <Text className="text-muted">
              {selectedClientFilterId
                ? 'No sessions found for this customer.'
                : 'No sessions yet. Use Clock In on Dashboard.'}
            </Text>
          ) : null}

          {groupedWeeks.map((weekGroup) => (
            <View key={weekGroup.key} className="gap-3 rounded-xl border border-border bg-card p-4">
              <Text className="text-lg font-bold text-heading">{weekGroup.label}</Text>
              {weekGroup.sessions.map((session) => {
                const isInvoiced = session.invoice_id !== null;
                const cardClass = isInvoiced
                  ? 'gap-2 rounded-md border border-invoiced-surface bg-invoiced-surface p-3'
                  : 'gap-2 rounded-md border border-border bg-background p-3';
                const headingTextClass = isInvoiced ? 'font-semibold text-invoiced-text' : 'font-semibold text-heading';
                const bodyTextClass = isInvoiced ? 'text-sm text-invoiced-muted' : 'text-sm text-foreground';
                const metaTextClass = isInvoiced ? 'text-xs text-invoiced-muted' : 'text-xs text-muted';
                const buttonClass = isInvoiced
                  ? 'rounded-md border border-invoiced-muted px-3 py-1'
                  : 'rounded-md border border-border px-3 py-1';
                const buttonTextClass = isInvoiced
                  ? 'text-sm font-semibold text-invoiced-text'
                  : 'text-sm font-semibold text-heading';

                return (
                  <View key={session.id} className={cardClass}>
                    <View className="flex-row items-start justify-between gap-3">
                      <View className="flex-1 gap-1">
                        <Text className={headingTextClass}>{session.client_name ?? session.client}</Text>
                        <Text className={bodyTextClass}>
                          {session.project_name ?? 'No project'} | {session.task_name ?? 'No task'}
                        </Text>
                      </View>
                      <Pressable className={buttonClass} onPress={() => openEditModal(session)}>
                        <Text className={buttonTextClass}>Edit</Text>
                      </Pressable>
                    </View>

                    <Text className={metaTextClass}>{new Date(session.start_time).toLocaleString()}</Text>
                    <Text className={bodyTextClass}>Duration: {formatDuration(session.duration)}</Text>
                    <GitHubCommitBadge
                      commitSha={session.commit_sha}
                      commitUrl={session.commit_url ?? null}
                      textClassName={isInvoiced ? 'text-xs text-invoiced-muted' : 'text-xs text-secondary'}
                    />
                    {session.notes ? <Text className={bodyTextClass}>{session.notes}</Text> : null}
                    {typeof session.break_count === 'number' && session.break_count > 0 ? (
                      <Text className={metaTextClass}>Breaks: {session.break_count}</Text>
                    ) : null}
                    <Text className={metaTextClass}>
                      Status: {getSessionStatus(session)} |{' '}
                      <Text className={isInvoiced ? 'font-semibold text-success' : 'font-semibold text-secondary'}>
                        {isInvoiced ? 'Invoiced' : 'Uninvoiced'}
                      </Text>
                    </Text>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </View>

      <Modal
        visible={editingSession !== null}
        transparent
        animationType="slide"
        onRequestClose={closeEditModal}
      >
        <View className="flex-1 justify-end bg-black/45">
          <View className="max-h-[90%] gap-3 rounded-t-2xl bg-card p-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-xl font-bold text-heading">Edit Session</Text>
              <Pressable className="rounded-md border border-border px-3 py-1" onPress={closeEditModal}>
                <Text className="font-semibold text-heading">Close</Text>
              </Pressable>
            </View>

            <ScrollView contentInsetAdjustmentBehavior="automatic">
              <View className="gap-3 pb-4">
                <SelectField
                  label="Customer"
                  value={editClientId}
                  options={clients.map((client) => ({ id: client.id, label: client.name }))}
                  placeholder="Select customer"
                  createValue={CREATE_CLIENT_PICKER_VALUE}
                  onSelect={(value) => {
                    setEditClientId(value);
                    setIsCreatingEditClient(false);
                  }}
                  onCreateNew={() => {
                    setIsCreatingEditClient(true);
                    setIsCreatingEditProject(false);
                    setIsCreatingEditTask(false);
                  }}
                />
                {isCreatingEditClient ? (
                  <View className="gap-2 rounded-md border border-border bg-background p-3">
                    <TextInput
                      value={newEditClientName}
                      onChangeText={setNewEditClientName}
                      placeholder="Customer name"
                      className="rounded-md border border-border bg-card px-3 py-2 text-foreground"
                    />
                    <TextInput
                      value={newEditClientEmail}
                      onChangeText={setNewEditClientEmail}
                      placeholder="Customer email"
                      keyboardType="email-address"
                      className="rounded-md border border-border bg-card px-3 py-2 text-foreground"
                    />
                    <TextInput
                      value={newEditClientRate}
                      onChangeText={setNewEditClientRate}
                      placeholder="Hourly rate (optional)"
                      keyboardType="numeric"
                      className="rounded-md border border-border bg-card px-3 py-2 text-foreground"
                    />
                    <TextInput
                      value={newEditClientGithubOrg}
                      onChangeText={setNewEditClientGithubOrg}
                      placeholder="GitHub org / owner (optional)"
                      autoCapitalize="none"
                      autoCorrect={false}
                      className="rounded-md border border-border bg-card px-3 py-2 text-foreground"
                    />
                    <View className="flex-row gap-2">
                      <Pressable
                        className="rounded-md bg-secondary px-3 py-2"
                        onPress={() => {
                          handleCreateEditClient().catch((error: unknown) => {
                            const message =
                              error instanceof Error ? error.message : 'Failed to create customer.';
                            showActionErrorAlert(message);
                            setEditError(message);
                          });
                        }}
                      >
                        <Text className="font-semibold text-white">Save Customer</Text>
                      </Pressable>
                      <Pressable
                        className="rounded-md border border-border px-3 py-2"
                        onPress={() => setIsCreatingEditClient(false)}
                      >
                        <Text className="font-semibold text-heading">Cancel</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : null}

                <SelectField
                  label="Project"
                  value={editProjectId}
                  options={projects.map((project) => ({ id: project.id, label: project.name }))}
                  placeholder="Select project"
                  disabled={!editClientId}
                  createValue={CREATE_PROJECT_PICKER_VALUE}
                  onSelect={(value) => {
                    setEditProjectId(value);
                    setIsCreatingEditProject(false);
                  }}
                  onCreateNew={() => {
                    setIsCreatingEditProject(true);
                    setIsCreatingEditClient(false);
                    setIsCreatingEditTask(false);
                  }}
                />
                {isCreatingEditProject ? (
                  <View className="gap-2 rounded-md border border-border bg-background p-3">
                    <TextInput
                      value={newEditProjectName}
                      onChangeText={setNewEditProjectName}
                      placeholder="Project name"
                      className="rounded-md border border-border bg-card px-3 py-2 text-foreground"
                    />
                    <TextInput
                      value={newEditProjectGithubRepo}
                      onChangeText={setNewEditProjectGithubRepo}
                      placeholder="GitHub repo name (optional)"
                      autoCapitalize="none"
                      autoCorrect={false}
                      className="rounded-md border border-border bg-card px-3 py-2 text-foreground"
                    />
                    <View className="flex-row gap-2">
                      <Pressable
                        className="rounded-md bg-secondary px-3 py-2"
                        onPress={() => {
                          handleCreateEditProject().catch((error: unknown) => {
                            const message =
                              error instanceof Error ? error.message : 'Failed to create project.';
                            showActionErrorAlert(message);
                            setEditError(message);
                          });
                        }}
                      >
                        <Text className="font-semibold text-white">Save Project</Text>
                      </Pressable>
                      <Pressable
                        className="rounded-md border border-border px-3 py-2"
                        onPress={() => setIsCreatingEditProject(false)}
                      >
                        <Text className="font-semibold text-heading">Cancel</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : null}

                <SelectField
                  label="Task"
                  value={editTaskId}
                  options={tasks.map((task) => ({ id: task.id, label: task.name }))}
                  placeholder="Select task"
                  disabled={!editProjectId}
                  createValue={CREATE_TASK_PICKER_VALUE}
                  onSelect={(value) => {
                    setEditTaskId(value);
                    setIsCreatingEditTask(false);
                  }}
                  onCreateNew={() => {
                    setIsCreatingEditTask(true);
                    setIsCreatingEditClient(false);
                    setIsCreatingEditProject(false);
                    setIsEditTaskNameAutoFilled(false);
                  }}
                />
                {isCreatingEditTask ? (
                  <View className="gap-2 rounded-md border border-border bg-background p-3">
                    <TextInput
                      value={newEditTaskName}
                      onChangeText={(value) => {
                        setNewEditTaskName(value);
                        setIsEditTaskNameAutoFilled(false);
                      }}
                      placeholder="Task name"
                      className="rounded-md border border-border bg-card px-3 py-2 text-foreground"
                    />
                    {isEditTaskNameAutoFilled ? (
                      <Text className="text-xs text-muted">Auto-filled from branch name.</Text>
                    ) : null}
                    <TextInput
                      value={newEditTaskGithubBranch}
                      onChangeText={(value) => {
                        setNewEditTaskGithubBranch(value);
                        if (!newEditTaskName.trim()) {
                          const prettyName = prettifyBranchName(value);
                          if (prettyName) {
                            setNewEditTaskName(prettyName);
                            setIsEditTaskNameAutoFilled(true);
                          }
                        }
                      }}
                      placeholder="GitHub branch (optional)"
                      autoCapitalize="none"
                      autoCorrect={false}
                      className="rounded-md border border-border bg-card px-3 py-2 text-foreground"
                    />
                    <View className="flex-row gap-2">
                      <Pressable
                        className="rounded-md bg-secondary px-3 py-2"
                        onPress={() => {
                          handleCreateEditTask().catch((error: unknown) => {
                            const message =
                              error instanceof Error ? error.message : 'Failed to create task.';
                            showActionErrorAlert(message);
                            setEditError(message);
                          });
                        }}
                      >
                        <Text className="font-semibold text-white">Save Task</Text>
                      </Pressable>
                      <Pressable
                        className="rounded-md border border-border px-3 py-2"
                        onPress={() => {
                          setIsCreatingEditTask(false);
                          setIsEditTaskNameAutoFilled(false);
                        }}
                      >
                        <Text className="font-semibold text-heading">Cancel</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : null}

                <CalendarDateField label="Start Date" value={editStartDate} onChange={setEditStartDate} />

                <View className="gap-2">
                  <Text className="text-xs uppercase tracking-wide text-muted">Start Time</Text>
                  <TextInput
                    value={editStartTime}
                    onChangeText={setEditStartTime}
                  onBlur={() => {
                    const normalized = normalizeTimeInput(editStartTime);
                    if (normalized) {
                      setEditStartTime(normalized);
                    }
                  }}
                    placeholder="h:mm AM/PM"
                    keyboardType="numbers-and-punctuation"
                    className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
                  />
                </View>

                <CalendarDateField label="End Date" value={editEndDate} onChange={setEditEndDate} />

                <View className="gap-2">
                  <Text className="text-xs uppercase tracking-wide text-muted">End Time</Text>
                  <TextInput
                    value={editEndTime}
                    onChangeText={setEditEndTime}
                  onBlur={() => {
                    const normalized = normalizeTimeInput(editEndTime);
                    if (normalized) {
                      setEditEndTime(normalized);
                    }
                  }}
                    placeholder="h:mm AM/PM"
                    keyboardType="numbers-and-punctuation"
                    className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
                  />
                </View>
                {editRangeError ? <InlineNotice tone="error" message={editRangeError} /> : null}

                <View className="gap-2">
                  <Text className="text-xs uppercase tracking-wide text-muted">Notes (optional)</Text>
                  <TextInput
                    value={editNotes}
                    onChangeText={setEditNotes}
                    placeholder="Session notes"
                    className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
                  />
                </View>

                {editError ? <InlineNotice tone="error" message={editError} /> : null}

                <View className="flex-row gap-2">
                  <Pressable
                    className="flex-1 rounded-md border border-border px-4 py-2"
                    onPress={closeEditModal}
                    disabled={isSavingEdit}
                  >
                    <Text className="text-center font-semibold text-heading">Cancel</Text>
                  </Pressable>
                  <Pressable
                    className={`flex-1 rounded-md px-4 py-2 ${editRangeError ? 'bg-secondary/60' : 'bg-secondary'}`}
                    onPress={handleSaveEdit}
                    disabled={isSavingEdit || Boolean(editRangeError)}
                  >
                    <Text className="text-center font-semibold text-white">
                      {isSavingEdit ? 'Saving...' : 'Save Changes'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
