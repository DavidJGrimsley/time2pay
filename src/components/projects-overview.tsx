import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, Text, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp, LinearTransition } from 'react-native-reanimated';
import {
  createMilestoneChecklistItem,
  createProject,
  createProjectMilestone,
  deleteProjectMilestone,
  initializeDatabase,
  listClients,
  listMilestoneChecklistItemsByMilestoneIds,
  listProjectMilestones,
  listProjectsByClient,
  listSessionsByProject,
  updateMilestoneChecklistItem,
  updateClientHourlyRate,
  updateProjectMilestone,
  updateProjectPricing,
  type Client,
  type MilestoneAmountType,
  type MilestoneChecklistItem,
  type MilestoneCompletionMode,
  type PricingMode,
  type Project,
  type ProjectMilestone,
  type Session,
} from '@/database/db';
import { InlineNotice, type NoticeTone } from '@/components/inline-notice';
import { PickerControl, PickerField } from '@/components/picker-field';
import { buildNet7DueDateIso } from '@/services/invoice';
import {
  applyProjectMilestoneTemplate,
  completeMilestoneAndCreateInvoiceDraft,
  getPercentTotalWarning,
  sumPercentMilestones,
} from '@/services/project-pricing';
import { createTime2PayClient } from '@/services/client-sync';
import { showActionErrorAlert, showSystemConfirm, showValidationAlert } from '@/services/system-alert';

type StatusNotice = {
  message: string;
  tone: NoticeTone;
};

type ProjectsStatusSection = 'customerProject' | 'projectPricing' | 'addMilestone' | 'milestones';

type SectionStatusNotice = StatusNotice & {
  section: ProjectsStatusSection;
};

type LastProjectsSelection = {
  clientId: string | null;
  projectId: string | null;
};

const CREATE_CLIENT = '__create_client__';
const CREATE_PROJECT = '__create_project__';
const LAST_PROJECTS_SELECTIONS_KEY = 'time2pay.projects.last-selection';

function createId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function onlyNumber(value: string): string {
  return value.replace(/[^0-9.\-]/g, '');
}

function toIsoDay(input: Date): string {
  return input.toISOString().slice(0, 10);
}

function parseOptionalNonNegativeNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

function loadLastProjectsSelection(): LastProjectsSelection {
  if (typeof localStorage === 'undefined') {
    return { clientId: null, projectId: null };
  }

  try {
    const raw = localStorage.getItem(LAST_PROJECTS_SELECTIONS_KEY);
    if (!raw) {
      return { clientId: null, projectId: null };
    }
    const parsed = JSON.parse(raw) as LastProjectsSelection;
    return {
      clientId: parsed.clientId ?? null,
      projectId: parsed.projectId ?? null,
    };
  } catch {
    return { clientId: null, projectId: null };
  }
}

function saveLastProjectsSelection(selection: LastProjectsSelection): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  localStorage.setItem(LAST_PROJECTS_SELECTIONS_KEY, JSON.stringify(selection));
}

export function ProjectsOverview() {
  const { width } = useWindowDimensions();
  const selectionDefaults = useMemo(() => loadLastProjectsSelection(), []);
  const isLarge = width >= 1200;
  const isTablet = width >= 768 && width < 1200;
  const contentWidthStyle = isLarge
    ? ({ width: '90%' as const, maxWidth: 1500 } as const)
    : isTablet
      ? ({ width: '75%' as const } as const)
      : ({ width: '90%' as const } as const);
  const smoothLayout = useMemo(
    () => LinearTransition.springify().damping(20).stiffness(170),
    [],
  );
  const controlHeight = isLarge ? 52 : 46;
  const sectionCardClassName = isLarge ? 'gap-3 rounded-xl bg-card p-6' : 'gap-2 rounded-xl bg-card p-4';
  const sectionTitleClassName = isLarge ? 'text-3xl font-bold text-heading' : 'text-2xl font-bold text-heading';
  const subsectionTitleClassName = isLarge ? 'text-2xl font-bold text-heading' : 'text-xl font-bold text-heading';
  const fieldLabelClassName = isLarge ? 'text-sm uppercase tracking-wide text-muted' : 'text-xs uppercase tracking-wide text-muted';
  const formInputClassName = 'rounded-md border border-border bg-background px-3 text-base text-foreground';
  const fullFieldStyle = useMemo(() => ({ width: '100%' as const }), []);
  const fullControlStyle = useMemo(() => ({ width: '100%' as const, height: controlHeight }), [controlHeight]);

  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
  const [checklistByMilestoneId, setChecklistByMilestoneId] = useState<Record<string, MilestoneChecklistItem[]>>({});
  const [sessions, setSessions] = useState<Session[]>([]);

  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [sectionStatus, setSectionStatus] = useState<SectionStatusNotice | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newClientRate, setNewClientRate] = useState('');

  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectPricingMode, setNewProjectPricingMode] = useState<PricingMode>('hourly');
  const [newProjectFee, setNewProjectFee] = useState('');

  const [projectPricingMode, setProjectPricingMode] = useState<PricingMode>('hourly');
  const [projectFee, setProjectFee] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');

  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [newMilestoneAmountType, setNewMilestoneAmountType] = useState<MilestoneAmountType>('percent');
  const [newMilestoneAmountValue, setNewMilestoneAmountValue] = useState('');
  const [newMilestoneCompletionMode, setNewMilestoneCompletionMode] = useState<MilestoneCompletionMode>('toggle');
  const [isAddingMilestone, setIsAddingMilestone] = useState(false);
  const [isEditingProjectPricing, setIsEditingProjectPricing] = useState(true);
  const [showPricingInfo, setShowPricingInfo] = useState(false);

  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null);
  const [editMilestoneTitle, setEditMilestoneTitle] = useState('');
  const [editMilestoneAmountType, setEditMilestoneAmountType] = useState<MilestoneAmountType>('percent');
  const [editMilestoneAmountValue, setEditMilestoneAmountValue] = useState('');
  const [editMilestoneCompletionMode, setEditMilestoneCompletionMode] =
    useState<MilestoneCompletionMode>('toggle');

  const [newChecklistTextByMilestoneId, setNewChecklistTextByMilestoneId] = useState<Record<string, string>>({});
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [markAttachedSessionsInvoiced, setMarkAttachedSessionsInvoiced] = useState(true);
  const [syncMercury, setSyncMercury] = useState(false);
  const [mercuryCustomerEmail, setMercuryCustomerEmail] = useState('');
  const [mercuryInvoiceDate, setMercuryInvoiceDate] = useState(toIsoDay(new Date()));
  const [mercuryDueDate, setMercuryDueDate] = useState(buildNet7DueDateIso());

  const showStatus = useCallback((section: ProjectsStatusSection, notice: StatusNotice): void => {
    setSectionStatus({ section, ...notice });
  }, []);

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === selectedClientId) ?? null,
    [clients, selectedClientId],
  );
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const percentWarning = useMemo(() => getPercentTotalWarning(milestones), [milestones]);
  const completedSessions = useMemo(() => sessions.filter((session) => session.end_time !== null), [sessions]);

  async function loadProjects(clientId: string | null): Promise<void> {
    setEditingMilestoneId(null);

    if (!clientId) {
      setProjects([]);
      setSelectedProjectId(null);
      setIsCreatingProject(false);
      return;
    }

    const rows = await listProjectsByClient(clientId);
    setProjects(rows);
    setSelectedProjectId((current) => {
      if (current && rows.some((row) => row.id === current)) {
        return current;
      }
      return rows[0]?.id ?? null;
    });
    setIsCreatingProject(false);
  }

  async function loadProjectWorkspace(projectId: string | null): Promise<void> {
    if (!projectId) {
      setMilestones([]);
      setChecklistByMilestoneId({});
      setSessions([]);
      setSelectedSessionIds([]);
      setEditingMilestoneId(null);
      return;
    }

    const [nextMilestones, nextSessions] = await Promise.all([
      listProjectMilestones(projectId),
      listSessionsByProject({ projectId, uninvoicedOnly: true }),
    ]);
    setMilestones(nextMilestones);
    setSessions(nextSessions);

    const checklistRows = await listMilestoneChecklistItemsByMilestoneIds(
      nextMilestones.map((milestone) => milestone.id),
    );
    const grouped = checklistRows.reduce<Record<string, MilestoneChecklistItem[]>>((acc, row) => {
      if (!acc[row.milestone_id]) {
        acc[row.milestone_id] = [];
      }
      acc[row.milestone_id]?.push(row);
      return acc;
    }, {});
    setChecklistByMilestoneId(grouped);

    setSelectedSessionIds((current) =>
      current.filter((sessionId) =>
        nextSessions.some((session) => session.id === sessionId && session.end_time !== null),
      ),
    );
  }

  useEffect(() => {
    initializeDatabase()
      .then(async () => {
        const rows = await listClients();
        setClients(rows);
        setSelectedProjectId(selectionDefaults.projectId);
        setSelectedClientId(() => {
          if (selectionDefaults.clientId && rows.some((client) => client.id === selectionDefaults.clientId)) {
            return selectionDefaults.clientId;
          }
          return rows[0]?.id ?? null;
        });
      })
      .catch((error: unknown) => {
        showStatus('customerProject', {
          message: error instanceof Error ? error.message : 'Failed to initialize database.',
          tone: 'error',
        });
      });
  }, [selectionDefaults.clientId, selectionDefaults.projectId, showStatus]);

  useEffect(() => {
    loadProjects(selectedClientId).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to load projects.';
      showActionErrorAlert(message);
      showStatus('customerProject', { message, tone: 'error' });
    });
  }, [selectedClientId, showStatus]);

  useEffect(() => {
    if (selectedProject) {
      setProjectPricingMode(selectedProject.pricing_mode);
      setProjectFee(
        selectedProject.pricing_mode === 'milestone' && selectedProject.total_project_fee !== null
          ? selectedProject.total_project_fee.toString()
          : '',
      );
      if (selectedProject.pricing_mode === 'hourly') {
        setNewMilestoneAmountType('fixed');
      }
    } else {
      setProjectPricingMode('hourly');
      setProjectFee('');
      setShowPricingInfo(false);
      setIsAddingMilestone(false);
      setIsEditingProjectPricing(false);
    }

    setMercuryCustomerEmail(selectedClient?.email ?? '');
    setHourlyRate(selectedClient ? selectedClient.hourly_rate.toString() : '');

    loadProjectWorkspace(selectedProjectId).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to load project workspace.';
      showActionErrorAlert(message);
      showStatus('milestones', { message, tone: 'error' });
    });
  }, [selectedClient, selectedProject, selectedProjectId, showStatus]);

  useEffect(() => {
    if (selectedProjectId) {
      setIsEditingProjectPricing(true);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    saveLastProjectsSelection({
      clientId: selectedClientId,
      projectId: selectedProjectId,
    });
  }, [selectedClientId, selectedProjectId]);

  function startMilestoneEdit(milestone: ProjectMilestone): void {
    setEditingMilestoneId(milestone.id);
    setEditMilestoneTitle(milestone.title);
    setEditMilestoneAmountType(milestone.amount_type);
    setEditMilestoneAmountValue(milestone.amount_value.toString());
    setEditMilestoneCompletionMode(milestone.completion_mode);
  }

  function cancelMilestoneEdit(): void {
    setEditingMilestoneId(null);
    setEditMilestoneTitle('');
    setEditMilestoneAmountType('percent');
    setEditMilestoneAmountValue('');
    setEditMilestoneCompletionMode('toggle');
  }

  async function handleCreateClient(): Promise<void> {
    const name = newClientName.trim();
    const email = newClientEmail.trim();
    const hourlyRate = Number(newClientRate);
    if (!name || !email) {
      showValidationAlert('Customer name and email are required.');
      return;
    }
    if (!Number.isFinite(hourlyRate) || hourlyRate < 0) {
      showValidationAlert('Hourly rate must be a non-negative number.');
      return;
    }

    setIsBusy(true);
    try {
      const clientId = createId('client');
      await createTime2PayClient({ id: clientId, name, email, hourly_rate: hourlyRate });
      const rows = await listClients();
      setClients(rows);
      setSelectedClientId(clientId);
      setIsCreatingClient(false);
      setNewClientName('');
      setNewClientEmail('');
      setNewClientRate('');
      showStatus('customerProject', { message: 'Customer created.', tone: 'success' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create customer.';
      showActionErrorAlert(message);
      showStatus('customerProject', { message, tone: 'error' });
    } finally {
      setIsBusy(false);
    }
  }

  async function handleCreateProject(): Promise<void> {
    if (!selectedClientId) {
      showValidationAlert('Select a customer first.');
      return;
    }

    const name = newProjectName.trim();
    if (!name) {
      showValidationAlert('Project name is required.');
      return;
    }

    let totalFee: number | null = null;
    if (newProjectPricingMode === 'milestone') {
      const parsedFee = parseOptionalNonNegativeNumber(newProjectFee);
      if (parsedFee === null) {
        showValidationAlert('Total project fee is required for milestone pricing.');
        return;
      }
      totalFee = parsedFee;
    }

    setIsBusy(true);
    try {
      const projectId = createId('project');
      await createProject({
        id: projectId,
        client_id: selectedClientId,
        name,
        pricing_mode: newProjectPricingMode,
        total_project_fee: totalFee,
      });
      await loadProjects(selectedClientId);
      setSelectedProjectId(projectId);
      setIsCreatingProject(false);
      setNewProjectName('');
      setNewProjectPricingMode('hourly');
      setNewProjectFee('');
      showStatus('customerProject', { message: 'Project created.', tone: 'success' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create project.';
      showActionErrorAlert(message);
      showStatus('customerProject', { message, tone: 'error' });
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSaveProjectPricing(): Promise<void> {
    if (!selectedProject) {
      return;
    }

    if (projectPricingMode === 'hourly' && milestones.some((milestone) => milestone.amount_type === 'percent')) {
      showValidationAlert('Hourly pricing only supports fixed milestones. Delete or update percent milestones first.');
      return;
    }

    let parsedHourlyRate: number | null = null;
    if (projectPricingMode === 'hourly') {
      parsedHourlyRate = parseOptionalNonNegativeNumber(hourlyRate);
      if (parsedHourlyRate === null || !selectedClient) {
        showValidationAlert('Hourly rate is required for hourly pricing.');
        return;
      }
    }

    let totalFee: number | null = null;
    if (projectPricingMode === 'milestone') {
      const parsedFee = parseOptionalNonNegativeNumber(projectFee);
      if (parsedFee === null) {
        showValidationAlert('Total project fee is required for milestone pricing.');
        return;
      }
      totalFee = parsedFee;
    }

    setIsBusy(true);
    try {
      await updateProjectPricing({
        id: selectedProject.id,
        pricing_mode: projectPricingMode,
        total_project_fee: totalFee,
      });
      if (projectPricingMode === 'hourly' && selectedClient && parsedHourlyRate !== null) {
        await updateClientHourlyRate({
          id: selectedClient.id,
          hourly_rate: parsedHourlyRate,
        });
        const refreshedClients = await listClients();
        setClients(refreshedClients);
      }
      await loadProjects(selectedProject.client_id);
      setIsEditingProjectPricing(false);
      showStatus('projectPricing', { message: 'Project pricing saved.', tone: 'success' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update project pricing.';
      showActionErrorAlert(message);
      showStatus('projectPricing', { message, tone: 'error' });
    } finally {
      setIsBusy(false);
    }
  }

  async function handleProjectPricingModeChange(mode: PricingMode): Promise<void> {
    if (mode === projectPricingMode) {
      return;
    }

    if (mode === 'hourly') {
      if (projectPricingMode === 'milestone' && milestones.length > 0) {
        const deleteMilestones = await showSystemConfirm({
          title: 'Delete existing milestones?',
          message: 'This project has milestones. Delete them now for hourly pricing?',
          confirmLabel: 'Delete all',
          cancelLabel: 'Keep milestones',
        });

        if (deleteMilestones) {
          setIsBusy(true);
          try {
            for (const milestone of milestones) {
              await deleteProjectMilestone(milestone.id);
            }
            if (selectedProjectId) {
              await loadProjectWorkspace(selectedProjectId);
            }
            showStatus('projectPricing', {
              message: 'All milestones deleted. You can still add fixed milestones on hourly projects.',
              tone: 'success',
            });
          } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Failed to delete existing milestones.';
            showActionErrorAlert(message);
            showStatus('projectPricing', { message, tone: 'error' });
            return;
          } finally {
            setIsBusy(false);
          }
        } else {
          showStatus('projectPricing', {
            message: 'Keeping existing milestones for hourly pricing.',
            tone: 'neutral',
          });
        }
      }

      setProjectFee('');
      if (newMilestoneAmountType === 'percent') {
        setNewMilestoneAmountType('fixed');
      }
    }

    setProjectPricingMode(mode);
  }

  async function handleApplyTemplate(): Promise<void> {
    if (!selectedProject) {
      showValidationAlert('Select a project first.');
      return;
    }
    if (milestones.length > 0) {
      showValidationAlert('Starter 50/25/25 can only be applied when no milestones exist.');
      return;
    }

    setIsBusy(true);
    try {
      await applyProjectMilestoneTemplate({ projectId: selectedProject.id });
      await loadProjectWorkspace(selectedProject.id);
      showStatus('projectPricing', { message: 'Applied starter 50/25/25 milestone template.', tone: 'success' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to apply milestone template.';
      showActionErrorAlert(message);
      showStatus('projectPricing', { message, tone: 'error' });
    } finally {
      setIsBusy(false);
    }
  }

  async function handleCreateMilestone(): Promise<void> {
    if (!selectedProject) {
      showValidationAlert('Select a project first.');
      return;
    }

    const title = newMilestoneTitle.trim();
    const amountValue = parseOptionalNonNegativeNumber(newMilestoneAmountValue);
    const amountType = projectPricingMode === 'hourly' ? 'fixed' : newMilestoneAmountType;
    if (!title) {
      showValidationAlert('Milestone title is required.');
      return;
    }
    if (amountValue === null) {
      showValidationAlert('Milestone amount must be a non-negative number.');
      return;
    }
    if (projectPricingMode === 'milestone' && amountType === 'percent') {
      const nextPercentTotal = sumPercentMilestones(milestones) + amountValue;
      if (nextPercentTotal > 100.0001) {
        showValidationAlert('Percent milestones cannot exceed 100%.');
        return;
      }
    }

    setIsBusy(true);
    try {
      await createProjectMilestone({
        id: createId('milestone'),
        project_id: selectedProject.id,
        title,
        amount_type: amountType,
        amount_value: amountValue,
        completion_mode: newMilestoneCompletionMode,
        due_note: null,
        sort_order: milestones.length,
      });
      await loadProjectWorkspace(selectedProject.id);
      setNewMilestoneTitle('');
      setNewMilestoneAmountType(projectPricingMode === 'hourly' ? 'fixed' : 'percent');
      setNewMilestoneAmountValue('');
      setNewMilestoneCompletionMode('toggle');
      setIsAddingMilestone(false);
      showStatus('addMilestone', { message: 'Milestone created.', tone: 'success' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create milestone.';
      showActionErrorAlert(message);
      showStatus('addMilestone', { message, tone: 'error' });
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSaveMilestone(milestone: ProjectMilestone): Promise<void> {
    const title = editMilestoneTitle.trim();
    const amountValue = parseOptionalNonNegativeNumber(editMilestoneAmountValue);
    const amountType = editMilestoneAmountType;

    if (!title) {
      showValidationAlert('Milestone title is required.');
      return;
    }
    if (amountValue === null) {
      showValidationAlert('Milestone amount must be a non-negative number.');
      return;
    }
    if (projectPricingMode === 'milestone' && amountType === 'percent') {
      const otherPercentTotal = milestones
        .filter((row) => row.id !== milestone.id && row.amount_type === 'percent')
        .reduce((sum, row) => sum + row.amount_value, 0);
      if (otherPercentTotal + amountValue > 100.0001) {
        showValidationAlert('Percent milestones cannot exceed 100%.');
        return;
      }
    }

    setIsBusy(true);
    try {
      await updateProjectMilestone({
        id: milestone.id,
        title,
        amount_type: amountType,
        amount_value: amountValue,
        completion_mode: editMilestoneCompletionMode,
        due_note: milestone.due_note,
        sort_order: milestone.sort_order,
      });
      if (selectedProjectId) {
        await loadProjectWorkspace(selectedProjectId);
      }
      cancelMilestoneEdit();
      showStatus('milestones', { message: 'Milestone updated.', tone: 'success' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update milestone.';
      showActionErrorAlert(message);
      showStatus('milestones', { message, tone: 'error' });
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDeleteMilestone(milestone: ProjectMilestone): Promise<void> {
    const confirmed = await showSystemConfirm({
      title: 'Delete milestone?',
      message: `This removes "${milestone.title}" and its checklist items from this project.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
    });
    if (!confirmed) {
      return;
    }

    setIsBusy(true);
    try {
      await deleteProjectMilestone(milestone.id);
      if (selectedProjectId) {
        await loadProjectWorkspace(selectedProjectId);
      }
      cancelMilestoneEdit();
      showStatus('milestones', { message: 'Milestone deleted.', tone: 'success' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete milestone.';
      showActionErrorAlert(message);
      showStatus('milestones', { message, tone: 'error' });
    } finally {
      setIsBusy(false);
    }
  }

  async function handleMoveMilestone(milestoneId: string, direction: 'up' | 'down'): Promise<void> {
    const fromIndex = milestones.findIndex((row) => row.id === milestoneId);
    if (fromIndex === -1) {
      return;
    }

    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= milestones.length) {
      return;
    }

    const source = milestones[fromIndex];
    const target = milestones[toIndex];
    if (!source || !target || !selectedProjectId) {
      return;
    }

    setIsBusy(true);
    try {
      await updateProjectMilestone({
        id: source.id,
        title: source.title,
        amount_type: source.amount_type,
        amount_value: source.amount_value,
        completion_mode: source.completion_mode,
        due_note: source.due_note,
        sort_order: target.sort_order,
      });
      await updateProjectMilestone({
        id: target.id,
        title: target.title,
        amount_type: target.amount_type,
        amount_value: target.amount_value,
        completion_mode: target.completion_mode,
        due_note: target.due_note,
        sort_order: source.sort_order,
      });
      await loadProjectWorkspace(selectedProjectId);
      showStatus('milestones', { message: 'Milestone order updated.', tone: 'success' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to reorder milestones.';
      showActionErrorAlert(message);
      showStatus('milestones', { message, tone: 'error' });
    } finally {
      setIsBusy(false);
    }
  }

  async function handleAddChecklistItem(milestoneId: string): Promise<void> {
    const label = (newChecklistTextByMilestoneId[milestoneId] ?? '').trim();
    if (!label) {
      showValidationAlert('Checklist item text is required.');
      return;
    }

    const list = checklistByMilestoneId[milestoneId] ?? [];
    setIsBusy(true);
    try {
      await createMilestoneChecklistItem({
        id: createId('checklist'),
        milestone_id: milestoneId,
        label,
        sort_order: list.length,
      });
      setNewChecklistTextByMilestoneId((current) => ({ ...current, [milestoneId]: '' }));
      if (selectedProjectId) {
        await loadProjectWorkspace(selectedProjectId);
      }
      showStatus('milestones', { message: 'Checklist item added.', tone: 'success' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to add checklist item.';
      showActionErrorAlert(message);
      showStatus('milestones', { message, tone: 'error' });
    } finally {
      setIsBusy(false);
    }
  }

  async function handleToggleChecklist(item: MilestoneChecklistItem): Promise<void> {
    setIsBusy(true);
    try {
      const isCompleted = !Boolean(item.is_completed);
      await updateMilestoneChecklistItem({
        id: item.id,
        label: item.label,
        sort_order: item.sort_order,
        is_completed: isCompleted,
        completed_at: isCompleted ? new Date().toISOString() : null,
      });
      if (selectedProjectId) {
        await loadProjectWorkspace(selectedProjectId);
      }
      showStatus('milestones', { message: 'Checklist updated.', tone: 'success' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to update checklist item.';
      showActionErrorAlert(message);
      showStatus('milestones', { message, tone: 'error' });
    } finally {
      setIsBusy(false);
    }
  }

  async function handleCreateMilestoneInvoice(milestone: ProjectMilestone): Promise<void> {
    if (!selectedClient || !selectedProject) {
      showValidationAlert('Select a customer and project first.');
      return;
    }

    if (syncMercury && !mercuryCustomerEmail.trim()) {
      showValidationAlert('Customer email is required when Mercury sync is enabled.');
      return;
    }

    const confirmed = await showSystemConfirm({
      title: 'Create milestone draft invoice?',
      message: 'This marks the milestone complete and creates an editable invoice draft (not finalized/sent).',
      confirmLabel: 'Create Draft',
      cancelLabel: 'Cancel',
    });
    if (!confirmed) {
      return;
    }

    setIsBusy(true);
    try {
      const invoiceId = createId('invoice');
      const result = await completeMilestoneAndCreateInvoiceDraft({
        invoiceId,
        clientId: selectedClient.id,
        projectId: selectedProject.id,
        projectName: selectedProject.name,
        projectTotalFee: selectedProject.total_project_fee,
        milestoneId: milestone.id,
        sessionIds: selectedSessionIds,
        markAttachedSessionsInvoiced,
        hourlyRateForSessionAppendix: selectedClient.hourly_rate,
        mercury: syncMercury
          ? {
              enabled: true,
              customerName: selectedClient.name,
              customerEmail: mercuryCustomerEmail.trim(),
              dueDateIso: mercuryDueDate,
              invoiceDateIso: mercuryInvoiceDate,
            }
          : undefined,
      });
      await loadProjectWorkspace(selectedProject.id);
      showStatus('milestones', {
        message: `Draft invoice ${invoiceId} created for ${milestone.title} ($${result.totalAmount.toFixed(2)}).`,
        tone: result.mercuryWarning ? 'error' : 'success',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create milestone invoice.';
      showActionErrorAlert(message);
      showStatus('milestones', { message, tone: 'error' });
    } finally {
      setIsBusy(false);
    }
  }

  function toggleSession(sessionId: string): void {
    setSelectedSessionIds((current) =>
      current.includes(sessionId)
        ? current.filter((existing) => existing !== sessionId)
        : [...current, sessionId],
    );
  }

  return (
    <View className="gap-3">
      <Text className="text-3xl font-extrabold text-heading">Projects</Text>
      <Text className="text-muted">
        Milestone-based pricing with optional session attachments and Mercury sync.
      </Text>

      <View className="items-center">
        <View className="w-full gap-3" style={contentWidthStyle}>
          <Animated.View className={sectionCardClassName} layout={smoothLayout}>
            <View className={isLarge ? 'flex-row gap-4' : 'gap-4'}>
              <View className="flex-1 gap-3">
                <Text className={sectionTitleClassName}>Project Info</Text>

            <View style={fullFieldStyle}>
              <PickerField
                label="Customer"
                value={selectedClientId}
                options={clients.map((client) => ({ id: client.id, label: client.name }))}
                placeholder="Select customer"
                createValue={CREATE_CLIENT}
                createLabel="+ Create customer"
                large={isLarge}
                disabled={isBusy}
                onSelect={(value) => {
                  setIsCreatingClient(false);
                  setIsCreatingProject(false);
                  setSelectedClientId(value);
                }}
                onCreateNew={() => setIsCreatingClient(true)}
              />
            </View>

            <View style={fullFieldStyle}>
              <PickerField
                label="Project"
                value={selectedClientId ? selectedProjectId : null}
                options={projects.map((project) => ({ id: project.id, label: project.name }))}
                placeholder={selectedClientId ? 'Select project' : 'Select customer first'}
                createValue={CREATE_PROJECT}
                createLabel="+ Create project"
                showCreateOption={Boolean(selectedClientId)}
                large={isLarge}
                disabled={isBusy || !selectedClientId}
                onSelect={(value) => {
                  setIsCreatingProject(false);
                  setSelectedProjectId(value);
                }}
                onCreateNew={() => {
                  if (!selectedClientId) {
                    showValidationAlert('Select a customer first.');
                    return;
                  }
                  setIsCreatingProject(true);
                  setSelectedProjectId(null);
                }}
              />
            </View>

            {isCreatingClient ? (
              <Animated.View
                className="gap-2 rounded-md border border-border bg-background p-3"
                entering={FadeInDown.duration(180)}
                exiting={FadeOutUp.duration(140)}
                layout={smoothLayout}
              >
                <TextInput
                  value={newClientName}
                  onChangeText={setNewClientName}
                  placeholder="Customer name"
                  className={formInputClassName}
                  style={fullControlStyle}
                />
                <TextInput
                  value={newClientEmail}
                  onChangeText={setNewClientEmail}
                  placeholder="Customer email"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  className={formInputClassName}
                  style={fullControlStyle}
                />
                <TextInput
                  value={newClientRate}
                  onChangeText={(value) => setNewClientRate(onlyNumber(value))}
                  placeholder="Hourly rate"
                  keyboardType="decimal-pad"
                  className={formInputClassName}
                  style={fullControlStyle}
                />
                <View className="flex-row gap-2">
                  <Pressable className="rounded-md bg-secondary px-3 py-2" onPress={handleCreateClient}>
                    <Text className="font-semibold text-white">Save customer</Text>
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

            {isCreatingProject ? (
              <Animated.View
                className="gap-2 rounded-md border border-border bg-background p-3"
                entering={FadeInDown.duration(180)}
                exiting={FadeOutUp.duration(140)}
                layout={smoothLayout}
              >
                <Text className="text-sm font-semibold text-heading">Create project</Text>
                <TextInput
                  value={newProjectName}
                  onChangeText={setNewProjectName}
                  placeholder="Project name"
                  className={formInputClassName}
                  style={fullControlStyle}
                />
                <PickerControl
                  selectedValue={newProjectPricingMode}
                  items={[
                    { label: 'Hourly', value: 'hourly' },
                    { label: 'Milestone', value: 'milestone' },
                  ]}
                  large={isLarge}
                  containerStyle={fullFieldStyle}
                  onValueChange={(value) => {
                    const mode = value as PricingMode;
                    setNewProjectPricingMode(mode);
                    if (mode === 'hourly') {
                      setNewProjectFee('');
                    }
                  }}
                />
                {newProjectPricingMode === 'milestone' ? (
                  <TextInput
                    value={newProjectFee}
                    onChangeText={(value) => setNewProjectFee(onlyNumber(value))}
                    placeholder="Total project fee"
                    keyboardType="decimal-pad"
                    className={formInputClassName}
                    style={fullControlStyle}
                  />
                ) : null}
                <View className="flex-row gap-2">
                  <Pressable className="self-start rounded-md bg-secondary px-3 py-2" onPress={handleCreateProject}>
                    <Text className="font-semibold text-white">Create project</Text>
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

            {selectedProject ? (
              <View className="gap-2 pt-2">
                <View className="flex-row items-center justify-between">
                  <Text className={fieldLabelClassName}>Project pricing</Text>
                  <Pressable
                    className="h-9 w-9 items-center justify-center rounded-full border border-border bg-background"
                    onPress={() => setShowPricingInfo((current) => !current)}
                  >
                    <Text className="text-base font-bold text-heading">i</Text>
                  </Pressable>
                </View>

                {showPricingInfo ? (
                  <Animated.View entering={FadeInDown.duration(180)} exiting={FadeOutUp.duration(140)} layout={smoothLayout}>
                    <Text className="text-sm text-muted">
                      Hourly projects can still have milestones for flat rates (such as specific features or an
                      end-of-project publishing fee). Milestone-based projects can still have hourly sessions
                      (such as work outside the initial project scope).
                    </Text>
                  </Animated.View>
                ) : null}

                {isEditingProjectPricing ? (
                  <>
                    <PickerControl
                      selectedValue={projectPricingMode}
                      items={[
                        { label: 'Hourly', value: 'hourly' },
                        { label: 'Milestone', value: 'milestone' },
                      ]}
                      large={isLarge}
                      containerStyle={fullFieldStyle}
                      onValueChange={(value) => {
                        handleProjectPricingModeChange(value as PricingMode).catch(() => undefined);
                      }}
                    />
                    {projectPricingMode === 'milestone' ? (
                      <TextInput
                        value={projectFee}
                        onChangeText={(value) => setProjectFee(onlyNumber(value))}
                        placeholder="Total project fee"
                        keyboardType="decimal-pad"
                        className={formInputClassName}
                        style={fullControlStyle}
                      />
                    ) : (
                      <View className="gap-1">
                        <Text className="text-xs uppercase tracking-wide text-muted">Hourly rate</Text>
                        <TextInput
                          value={hourlyRate}
                          onChangeText={(value) => setHourlyRate(onlyNumber(value))}
                          placeholder="Hourly rate"
                          keyboardType="decimal-pad"
                          className={formInputClassName}
                          style={fullControlStyle}
                        />
                        <Text className="text-xs text-muted">Hourly projects do not require a total project fee.</Text>
                      </View>
                    )}
                  </>
                ) : (
                  <Text className="text-sm text-muted">
                    {projectPricingMode === 'milestone'
                      ? `Milestone pricing${projectFee ? ` - total fee $${projectFee}` : ''}`
                      : `Hourly pricing${hourlyRate ? ` - $${hourlyRate}/hr` : ''}`}
                  </Text>
                )}
                <View className="flex-row gap-2">
                  <Pressable
                    className="rounded-md bg-secondary px-3 py-2"
                    onPress={() => {
                      if (isEditingProjectPricing) {
                        handleSaveProjectPricing().catch(() => undefined);
                        return;
                      }
                      setIsEditingProjectPricing(true);
                    }}
                  >
                    <Text className="font-semibold text-white">
                      {isEditingProjectPricing ? 'Save pricing' : 'Edit pricing'}
                    </Text>
                  </Pressable>
                  {projectPricingMode === 'milestone' ? (
                    <Pressable
                      className="rounded-md border border-border px-3 py-2"
                      onPress={() => selectedProject && handleApplyTemplate()}
                    >
                      <Text className="font-semibold text-heading">Apply 50/25/25</Text>
                    </Pressable>
                  ) : null}
                </View>
                {projectPricingMode === 'milestone' && percentWarning ? (
                  <InlineNotice tone="neutral" message={percentWarning} />
                ) : null}
                {sectionStatus?.section === 'projectPricing' ? (
                  <InlineNotice tone={sectionStatus.tone} message={sectionStatus.message} />
                ) : null}
              </View>
            ) : null}

            {sectionStatus?.section === 'customerProject' ? (
              <InlineNotice tone={sectionStatus.tone} message={sectionStatus.message} />
            ) : null}
              </View>

              <View className="flex-1 gap-2">
                <View className="flex-row items-center justify-between">
                  <Text className={subsectionTitleClassName}>Milestones</Text>
                  {selectedProject ? (
                    <Pressable
                      className="h-9 w-9 items-center justify-center rounded-md bg-secondary"
                      onPress={() => setIsAddingMilestone(true)}
                    >
                      <Text className="text-xl font-bold text-white">+</Text>
                    </Pressable>
                  ) : null}
                </View>
                {!selectedProject ? <Text className="text-sm text-muted">Select a project to manage milestones.</Text> : null}
                {selectedProject && milestones.length === 0 ? <Text className="text-sm text-muted">No milestones yet.</Text> : null}

                {selectedProject
                  ? milestones.map((milestone, milestoneIndex) => {
                      const checklist = checklistByMilestoneId[milestone.id] ?? [];
                      const completedCount = checklist.filter((item) => item.is_completed === 1).length;
                      const isEditing = editingMilestoneId === milestone.id;
                      return (
                        <Animated.View
                          key={milestone.id}
                          className="gap-2 rounded-md border border-border bg-background p-3"
                          entering={FadeInDown.duration(180)}
                          exiting={FadeOutUp.duration(140)}
                          layout={smoothLayout}
                        >
                    {isEditing ? (
                      <View className="gap-2 rounded-md border border-border bg-card p-3">
                        <Text className="text-sm font-semibold text-heading">Edit milestone</Text>
                        <TextInput
                          value={editMilestoneTitle}
                          onChangeText={setEditMilestoneTitle}
                          placeholder="Milestone title"
                          className={formInputClassName}
                          style={fullControlStyle}
                        />
                        <PickerControl
                          selectedValue={editMilestoneAmountType}
                          items={[
                            ...(projectPricingMode === 'milestone' || editMilestoneAmountType === 'percent'
                              ? [{ label: 'Percent', value: 'percent' }]
                              : []),
                            { label: 'Fixed', value: 'fixed' },
                          ]}
                          large={isLarge}
                          containerStyle={fullFieldStyle}
                          onValueChange={(value) => setEditMilestoneAmountType(value as MilestoneAmountType)}
                        />
                        <TextInput
                          value={editMilestoneAmountValue}
                          onChangeText={(value) => setEditMilestoneAmountValue(onlyNumber(value))}
                          placeholder="Amount"
                          keyboardType="decimal-pad"
                          className={formInputClassName}
                          style={fullControlStyle}
                        />
                        <PickerControl
                          selectedValue={editMilestoneCompletionMode}
                          items={[
                            { label: 'Toggle', value: 'toggle' },
                            { label: 'Checklist', value: 'checklist' },
                          ]}
                          large={isLarge}
                          containerStyle={fullFieldStyle}
                          onValueChange={(value) => setEditMilestoneCompletionMode(value as MilestoneCompletionMode)}
                        />
                        <View className="flex-row gap-2">
                          <Pressable
                            className="rounded-md bg-secondary px-3 py-2"
                            onPress={() => handleSaveMilestone(milestone)}
                          >
                            <Text className="font-semibold text-white">Save milestone</Text>
                          </Pressable>
                          <Pressable
                            className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2"
                            onPress={() => handleDeleteMilestone(milestone)}
                          >
                            <Text className="font-semibold text-danger">Delete milestone</Text>
                          </Pressable>
                          <Pressable
                            className="rounded-md border border-border px-3 py-2"
                            onPress={cancelMilestoneEdit}
                          >
                            <Text className="font-semibold text-heading">Cancel</Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : (
                      <View className="flex-row items-start justify-between gap-3">
                        <View className="flex-1">
                          <Text className="font-semibold text-heading">{milestone.title}</Text>
                          <Text className="text-xs text-muted">
                            {milestone.amount_type === 'percent'
                              ? `${milestone.amount_value.toFixed(2)}%`
                              : `$${milestone.amount_value.toFixed(2)}`}{' '}
                            - {milestone.completion_mode}
                          </Text>
                          {milestone.is_completed ? (
                            <Text className="text-xs text-secondary">
                              Completed {milestone.completed_at ? new Date(milestone.completed_at).toLocaleString() : ''}
                            </Text>
                          ) : null}
                        </View>
                        <View className="flex-row gap-2">
                          <Pressable
                            className={`rounded-md border border-border px-2 py-2 ${
                              milestoneIndex === 0 || isBusy ? 'opacity-50' : ''
                            }`}
                            disabled={milestoneIndex === 0 || isBusy}
                            onPress={() => handleMoveMilestone(milestone.id, 'up')}
                          >
                            <Text className="font-semibold text-heading">Up</Text>
                          </Pressable>
                          <Pressable
                            className={`rounded-md border border-border px-2 py-2 ${
                              milestoneIndex === milestones.length - 1 || isBusy ? 'opacity-50' : ''
                            }`}
                            disabled={milestoneIndex === milestones.length - 1 || isBusy}
                            onPress={() => handleMoveMilestone(milestone.id, 'down')}
                          >
                            <Text className="font-semibold text-heading">Down</Text>
                          </Pressable>
                          <Pressable
                            className="rounded-md border border-border px-3 py-2"
                            onPress={() => startMilestoneEdit(milestone)}
                          >
                            <Text className="font-semibold text-heading">Edit</Text>
                          </Pressable>
                        </View>
                      </View>
                    )}

                    {milestone.completion_mode === 'checklist' ? (
                      <View className="gap-1 rounded-md border border-border bg-card p-2">
                        <Text className="text-xs text-muted">
                          Checklist ({completedCount}/{checklist.length})
                        </Text>
                        {checklist.map((item) => (
                          <Pressable
                            key={item.id}
                            className="flex-row items-center gap-2"
                            onPress={() => handleToggleChecklist(item)}
                          >
                            <View
                              className={
                                item.is_completed
                                  ? 'h-4 w-4 items-center justify-center rounded border border-secondary bg-secondary'
                                  : 'h-4 w-4 rounded border border-border bg-background'
                              }
                            >
                              {item.is_completed ? <Text className="text-[10px] text-white">v</Text> : null}
                            </View>
                            <Text
                              className={
                                item.is_completed ? 'text-sm text-muted line-through' : 'text-sm text-foreground'
                              }
                            >
                              {item.label}
                            </Text>
                          </Pressable>
                        ))}
                        <View className="flex-row gap-2">
                          <TextInput
                            value={newChecklistTextByMilestoneId[milestone.id] ?? ''}
                            onChangeText={(value) =>
                              setNewChecklistTextByMilestoneId((current) => ({
                                ...current,
                                [milestone.id]: value,
                              }))
                            }
                            placeholder="Checklist item"
                            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-foreground"
                          />
                          <Pressable
                            className="rounded-md border border-border px-3 py-2"
                            onPress={() => handleAddChecklistItem(milestone.id)}
                          >
                            <Text className="font-semibold text-heading">Add</Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : null}

                    {!milestone.is_completed && !isEditing ? (
                      <View className="gap-1">
                        <Pressable
                          className="self-start rounded-md bg-secondary px-3 py-2"
                          onPress={() => handleCreateMilestoneInvoice(milestone)}
                        >
                          <Text className="font-semibold text-white">Complete + create draft invoice</Text>
                        </Pressable>
                        <Text className="text-xs text-muted">
                          Draft means saved and editable before final send/export.
                        </Text>
                      </View>
                    ) : null}
                  </Animated.View>
                        );
                      })
                  : null}
                {sectionStatus?.section === 'milestones' ? (
                  <InlineNotice tone={sectionStatus.tone} message={sectionStatus.message} />
                ) : null}
                {sectionStatus?.section === 'addMilestone' ? (
                  <InlineNotice tone={sectionStatus.tone} message={sectionStatus.message} />
                ) : null}
              </View>
            </View>
          </Animated.View>

          {selectedProject ? (
            <Animated.View className={sectionCardClassName} layout={smoothLayout}>
              <Text className={subsectionTitleClassName}>Invoice options</Text>
              <Pressable
                className="flex-row items-center gap-2"
                onPress={() => setMarkAttachedSessionsInvoiced((current) => !current)}
              >
                <View
                  className={
                    markAttachedSessionsInvoiced
                      ? 'h-4 w-4 items-center justify-center rounded border border-secondary bg-secondary'
                      : 'h-4 w-4 rounded border border-border bg-background'
                  }
                >
                  {markAttachedSessionsInvoiced ? <Text className="text-[10px] text-white">v</Text> : null}
                </View>
                <Text className="text-sm text-foreground">Mark attached sessions invoiced</Text>
              </Pressable>

              <Pressable className="flex-row items-center gap-2" onPress={() => setSyncMercury((current) => !current)}>
                <View
                  className={
                    syncMercury
                      ? 'h-4 w-4 items-center justify-center rounded border border-secondary bg-secondary'
                      : 'h-4 w-4 rounded border border-border bg-background'
                  }
                >
                  {syncMercury ? <Text className="text-[10px] text-white">v</Text> : null}
                </View>
                <Text className="text-sm text-foreground">Create matching invoice in Mercury</Text>
              </Pressable>
              <Text className="text-xs text-muted">
                This also creates the same invoice in Mercury AR. If Mercury fails, your local draft still saves.
              </Text>

              {syncMercury ? (
                <View className="gap-2 rounded-md border border-border bg-background p-3">
                  <Text className="text-xs uppercase tracking-wide text-muted">Customer email</Text>
                  <TextInput
                    value={mercuryCustomerEmail}
                    onChangeText={setMercuryCustomerEmail}
                    placeholder="Customer email"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    className={formInputClassName}
                    style={fullControlStyle}
                  />
                  <Text className="text-xs uppercase tracking-wide text-muted">Invoice date</Text>
                  <TextInput
                    value={mercuryInvoiceDate}
                    onChangeText={setMercuryInvoiceDate}
                    placeholder="Invoice date YYYY-MM-DD"
                    className={formInputClassName}
                    style={fullControlStyle}
                  />
                  <Text className="text-xs uppercase tracking-wide text-muted">Due date</Text>
                  <TextInput
                    value={mercuryDueDate}
                    onChangeText={setMercuryDueDate}
                    placeholder="Due date YYYY-MM-DD"
                    className={formInputClassName}
                    style={fullControlStyle}
                  />
                </View>
              ) : null}

              <Text className="text-sm font-semibold text-heading">Attach sessions (optional)</Text>
              {completedSessions.length === 0 ? (
                <Text className="text-sm text-muted">No completed uninvoiced sessions for this project.</Text>
              ) : null}
              {completedSessions.map((session) => {
                const active = selectedSessionIds.includes(session.id);
                return (
                  <Pressable
                    key={session.id}
                    className="flex-row items-start gap-2 rounded-md border border-border bg-background px-3 py-2"
                    onPress={() => toggleSession(session.id)}
                  >
                    <View
                      className={
                        active
                          ? 'mt-0.5 h-4 w-4 items-center justify-center rounded border border-secondary bg-secondary'
                          : 'mt-0.5 h-4 w-4 rounded border border-border bg-card'
                      }
                    >
                      {active ? <Text className="text-[10px] text-white">v</Text> : null}
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm text-foreground">
                        {session.task_name ?? session.task_id ?? 'Task'} -{' '}
                        {session.duration ? `${(session.duration / 3600).toFixed(2)}h` : '0.00h'}
                      </Text>
                      <Text className="text-xs text-muted">{new Date(session.start_time).toLocaleString()}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </Animated.View>
          ) : null}

        </View>
      </View>
      <Modal
        visible={isAddingMilestone && Boolean(selectedProject)}
        transparent
        animationType="fade"
        onRequestClose={() => setIsAddingMilestone(false)}
      >
        <View className="flex-1 items-center justify-center bg-black/55 px-4">
          <Animated.View className="w-full max-w-2xl gap-3 rounded-xl bg-card p-4" layout={smoothLayout}>
            <View className="flex-row items-center justify-between">
              <Text className={subsectionTitleClassName}>Add milestone</Text>
              <Pressable className="rounded-md border border-border px-2 py-1" onPress={() => setIsAddingMilestone(false)}>
                <Text className="font-semibold text-heading">x</Text>
              </Pressable>
            </View>

            <TextInput
              value={newMilestoneTitle}
              onChangeText={setNewMilestoneTitle}
              placeholder="Milestone title"
              className={formInputClassName}
              style={fullControlStyle}
            />
            <PickerControl
              selectedValue={newMilestoneAmountType}
              items={[
                ...(projectPricingMode === 'milestone' ? [{ label: 'Percent', value: 'percent' }] : []),
                { label: 'Fixed', value: 'fixed' },
              ]}
              large={isLarge}
              containerStyle={fullFieldStyle}
              onValueChange={(value) => setNewMilestoneAmountType(value as MilestoneAmountType)}
            />
            {projectPricingMode === 'hourly' ? (
              <Text className="text-xs text-muted">Hourly pricing supports fixed milestones only.</Text>
            ) : null}
            <TextInput
              value={newMilestoneAmountValue}
              onChangeText={(value) => setNewMilestoneAmountValue(onlyNumber(value))}
              placeholder="Amount"
              keyboardType="decimal-pad"
              className={formInputClassName}
              style={fullControlStyle}
            />
            <PickerControl
              selectedValue={newMilestoneCompletionMode}
              items={[
                { label: 'Toggle', value: 'toggle' },
                { label: 'Checklist', value: 'checklist' },
              ]}
              large={isLarge}
              containerStyle={fullFieldStyle}
              onValueChange={(value) => setNewMilestoneCompletionMode(value as MilestoneCompletionMode)}
            />

            <View className="flex-row gap-2">
              <Pressable
                className="rounded-md bg-secondary px-3 py-2"
                onPress={() => handleCreateMilestone().catch(() => undefined)}
              >
                <Text className="font-semibold text-white">Add milestone</Text>
              </Pressable>
              <Pressable className="rounded-md border border-border px-3 py-2" onPress={() => setIsAddingMilestone(false)}>
                <Text className="font-semibold text-heading">Cancel</Text>
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}
