import { getSupabaseClient } from '@/services/supabase-client';
import {
  callHostedWriteRoute,
  requireHostedUserId,
  toNumber,
  withHostedRead,
} from '@/database/hosted/shared/runtime';
import type {
  MilestoneAmountType,
  MilestoneChecklistItem,
  MilestoneCompletionMode,
  ProjectMilestone,
} from '@/database/hosted/types';

export function createProjectMilestone(input: {
  id: string;
  project_id: string;
  title: string;
  amount_type: MilestoneAmountType;
  amount_value: number;
  completion_mode: MilestoneCompletionMode;
  due_note?: string | null;
  sort_order: number;
}): Promise<void> {
  return callHostedWriteRoute('/api/db/milestones/create', {
    id: input.id,
    projectId: input.project_id,
    title: input.title,
    amountType: input.amount_type,
    amountValue: input.amount_value,
    completionMode: input.completion_mode,
    dueNote: input.due_note,
    sortOrder: input.sort_order,
  });
}

export function listProjectMilestones(projectId: string): Promise<ProjectMilestone[]> {
  return withHostedRead(async () => {
    const supabase = getSupabaseClient();
    const userId = await requireHostedUserId();
    const { data, error } = await supabase
      .from('project_milestones')
      .select(
        'id,project_id,title,amount_type,amount_value,completion_mode,due_note,sort_order,is_completed,completed_at,created_at,updated_at,deleted_at',
      )
      .eq('auth_user_id', userId)
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data ?? []) as Record<string, unknown>[];
    return rows.map((row) => ({
      id: String(row.id),
      project_id: String(row.project_id),
      title: String(row.title),
      amount_type: (row.amount_type as MilestoneAmountType) ?? 'fixed',
      amount_value: toNumber(row.amount_value),
      completion_mode: (row.completion_mode as MilestoneCompletionMode) ?? 'toggle',
      due_note: (row.due_note as string | null) ?? null,
      sort_order: Number(row.sort_order ?? 0),
      is_completed: row.is_completed ? 1 : 0,
      completed_at: (row.completed_at as string | null) ?? null,
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
      deleted_at: (row.deleted_at as string | null) ?? null,
    }));
  });
}

export function getProjectMilestoneById(milestoneId: string): Promise<ProjectMilestone | null> {
  return withHostedRead(async () => {
    const supabase = getSupabaseClient();
    const userId = await requireHostedUserId();
    const { data, error } = await supabase
      .from('project_milestones')
      .select(
        'id,project_id,title,amount_type,amount_value,completion_mode,due_note,sort_order,is_completed,completed_at,created_at,updated_at,deleted_at',
      )
      .eq('auth_user_id', userId)
      .eq('id', milestoneId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    if (!data) {
      return null;
    }

    const row = data as Record<string, unknown>;
    return {
      id: String(row.id),
      project_id: String(row.project_id),
      title: String(row.title),
      amount_type: (row.amount_type as MilestoneAmountType) ?? 'fixed',
      amount_value: toNumber(row.amount_value),
      completion_mode: (row.completion_mode as MilestoneCompletionMode) ?? 'toggle',
      due_note: (row.due_note as string | null) ?? null,
      sort_order: Number(row.sort_order ?? 0),
      is_completed: row.is_completed ? 1 : 0,
      completed_at: (row.completed_at as string | null) ?? null,
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
      deleted_at: (row.deleted_at as string | null) ?? null,
    };
  });
}

export function updateProjectMilestone(input: {
  id: string;
  title: string;
  amount_type: MilestoneAmountType;
  amount_value: number;
  completion_mode: MilestoneCompletionMode;
  due_note?: string | null;
  sort_order: number;
}): Promise<void> {
  return callHostedWriteRoute('/api/db/milestones/update', {
    id: input.id,
    title: input.title,
    amountType: input.amount_type,
    amountValue: input.amount_value,
    completionMode: input.completion_mode,
    dueNote: input.due_note,
    sortOrder: input.sort_order,
  });
}

export function deleteProjectMilestone(milestoneId: string): Promise<void> {
  return callHostedWriteRoute('/api/db/milestones/delete', { milestoneId });
}

export function setProjectMilestoneCompletion(input: {
  milestoneId: string;
  isCompleted: boolean;
  completedAtIso?: string | null;
}): Promise<void> {
  return callHostedWriteRoute('/api/db/milestones/set-completion', {
    milestoneId: input.milestoneId,
    isCompleted: input.isCompleted,
    completedAt: input.completedAtIso ?? null,
  });
}

export function createMilestoneChecklistItem(input: {
  id: string;
  milestone_id: string;
  label: string;
  sort_order: number;
}): Promise<void> {
  return callHostedWriteRoute('/api/db/milestone-checklist/create', {
    id: input.id,
    milestoneId: input.milestone_id,
    label: input.label,
    sortOrder: input.sort_order,
  });
}

export function listMilestoneChecklistItems(milestoneId: string): Promise<MilestoneChecklistItem[]> {
  return withHostedRead(async () => {
    const supabase = getSupabaseClient();
    const userId = await requireHostedUserId();
    const { data, error } = await supabase
      .from('milestone_checklist_items')
      .select(
        'id,milestone_id,label,sort_order,is_completed,completed_at,created_at,updated_at,deleted_at',
      )
      .eq('auth_user_id', userId)
      .eq('milestone_id', milestoneId)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data ?? []) as Record<string, unknown>[];
    return rows.map((row) => ({
      id: String(row.id),
      milestone_id: String(row.milestone_id),
      label: String(row.label),
      sort_order: Number(row.sort_order ?? 0),
      is_completed: row.is_completed ? 1 : 0,
      completed_at: (row.completed_at as string | null) ?? null,
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
      deleted_at: (row.deleted_at as string | null) ?? null,
    }));
  });
}

export function updateMilestoneChecklistItem(input: {
  id: string;
  label: string;
  sort_order: number;
  is_completed: boolean;
  completed_at?: string | null;
}): Promise<void> {
  return callHostedWriteRoute('/api/db/milestone-checklist/update', {
    id: input.id,
    label: input.label,
    sortOrder: input.sort_order,
    isCompleted: input.is_completed,
    completedAt: input.completed_at,
  });
}

export function listMilestoneChecklistItemsByMilestoneIds(
  milestoneIds: string[],
): Promise<MilestoneChecklistItem[]> {
  return withHostedRead(async () => {
    if (milestoneIds.length === 0) {
      return [];
    }

    const supabase = getSupabaseClient();
    const userId = await requireHostedUserId();
    const { data, error } = await supabase
      .from('milestone_checklist_items')
      .select(
        'id,milestone_id,label,sort_order,is_completed,completed_at,created_at,updated_at,deleted_at',
      )
      .eq('auth_user_id', userId)
      .in('milestone_id', milestoneIds)
      .is('deleted_at', null)
      .order('milestone_id', { ascending: true })
      .order('sort_order', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data ?? []) as Record<string, unknown>[];
    return rows.map((row) => ({
      id: String(row.id),
      milestone_id: String(row.milestone_id),
      label: String(row.label),
      sort_order: Number(row.sort_order ?? 0),
      is_completed: row.is_completed ? 1 : 0,
      completed_at: (row.completed_at as string | null) ?? null,
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
      deleted_at: (row.deleted_at as string | null) ?? null,
    }));
  });
}

export function areMilestoneChecklistItemsComplete(milestoneId: string): Promise<boolean> {
  return withHostedRead(async () => {
    const items = await listMilestoneChecklistItems(milestoneId);
    return items.length > 0 && items.every((item) => item.is_completed === 1);
  });
}
