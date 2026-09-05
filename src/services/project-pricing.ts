import {
  areMilestoneChecklistItemsComplete,
  createProjectMilestone,
  getProjectMilestoneById,
  listInvoices,
  listProjectMilestones,
  setProjectMilestoneCompletion,
  type MilestoneChecklistItem,
  type ProjectMilestone,
} from '@/database/db';

export type MilestoneTemplateRow = {
  title: string;
  amountType: ProjectMilestone['amount_type'];
  amountValue: number;
  completionMode: ProjectMilestone['completion_mode'];
  dueNote: string | null;
};

export const PROJECT_MILESTONE_TEMPLATE_50_25_25: MilestoneTemplateRow[] = [
  {
    title: 'Project Start',
    amountType: 'percent',
    amountValue: 50,
    completionMode: 'toggle',
    dueNote: null,
  },
  {
    title: 'Ready for testing',
    amountType: 'percent',
    amountValue: 25,
    completionMode: 'toggle',
    dueNote: null,
  },
  {
    title: 'Launch',
    amountType: 'percent',
    amountValue: 25,
    completionMode: 'toggle',
    dueNote: null,
  },
];

function createId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function sumPercentMilestones(milestones: ProjectMilestone[]): number {
  const percentTotal = milestones
    .filter((milestone) => milestone.amount_type === 'percent')
    .reduce((sum, milestone) => sum + milestone.amount_value, 0);

  return Number(percentTotal.toFixed(2));
}

export function getPercentTotalWarning(milestones: ProjectMilestone[]): string | null {
  const hasPercentMilestones = milestones.some((milestone) => milestone.amount_type === 'percent');
  if (!hasPercentMilestones) {
    return null;
  }

  const percentTotal = sumPercentMilestones(milestones);
  if (Math.abs(percentTotal - 100) < 0.0001) {
    return null;
  }

  return `Percent milestones currently total ${percentTotal.toFixed(2)}% (recommended: 100%).`;
}

export function canMilestoneBeCompleted(input: {
  milestone: ProjectMilestone;
  checklistItems: MilestoneChecklistItem[];
}): boolean {
  if (input.milestone.completion_mode === 'toggle') {
    return true;
  }

  const activeItems = input.checklistItems.filter((item) => item.deleted_at === null);
  if (activeItems.length === 0) {
    return false;
  }

  return activeItems.every((item) => Boolean(item.is_completed));
}

export async function applyProjectMilestoneTemplate(input: {
  projectId: string;
  template?: MilestoneTemplateRow[];
}): Promise<void> {
  const currentMilestones = await listProjectMilestones(input.projectId);
  const nextSortBase = currentMilestones.length;
  const template = input.template ?? PROJECT_MILESTONE_TEMPLATE_50_25_25;

  for (const [index, templateRow] of template.entries()) {
    await createProjectMilestone({
      id: createId('milestone'),
      project_id: input.projectId,
      title: templateRow.title,
      amount_type: templateRow.amountType,
      amount_value: templateRow.amountValue,
      completion_mode: templateRow.completionMode,
      due_note: templateRow.dueNote,
      sort_order: nextSortBase + index,
    });
  }
}

export async function setDashboardMilestoneCompletion(input: {
  milestoneId: string;
  isCompleted: boolean;
}): Promise<void> {
  const milestone = await getProjectMilestoneById(input.milestoneId);
  if (!milestone) {
    throw new Error('Milestone not found.');
  }
  if (input.isCompleted && milestone.completion_mode === 'checklist') {
    const checklistComplete = await areMilestoneChecklistItemsComplete(milestone.id);
    if (!checklistComplete) {
      throw new Error('Complete all checklist items before marking this milestone complete.');
    }
  }
  if (!input.isCompleted) {
    const invoices = await listInvoices();
    if (invoices.some((invoice) => invoice.source_milestone_id === milestone.id)) {
      throw new Error('This milestone cannot reopen after its invoice draft exists.');
    }
  }
  await setProjectMilestoneCompletion({
    milestoneId: milestone.id,
    isCompleted: input.isCompleted,
    completedAtIso: input.isCompleted ? new Date().toISOString() : null,
  });
}
