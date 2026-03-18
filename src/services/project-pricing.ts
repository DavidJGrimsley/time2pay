import {
  areMilestoneChecklistItemsComplete,
  createProjectMilestone,
  getProjectMilestoneById,
  listProjectMilestones,
  setProjectMilestoneCompletion,
  type MilestoneChecklistItem,
  type ProjectMilestone,
} from '@/database/db';
import {
  createMilestoneInvoice,
  type CreateMilestoneInvoiceInput,
  type MilestoneInvoiceComputation,
} from '@/services/invoice';

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

export type CompleteMilestoneAndCreateInvoiceInput = Omit<
  CreateMilestoneInvoiceInput,
  'milestoneTitle' | 'milestoneAmountType' | 'milestoneAmountValue' | 'milestoneCompletionMode' | 'milestoneCompletedAtIso'
> & {
  milestoneId: string;
};

export async function completeMilestoneAndCreateInvoiceDraft(
  input: CompleteMilestoneAndCreateInvoiceInput,
): Promise<MilestoneInvoiceComputation> {
  const milestone = await getProjectMilestoneById(input.milestoneId);
  if (!milestone) {
    throw new Error('Milestone not found.');
  }

  if (milestone.completion_mode === 'checklist') {
    const checklistComplete = await areMilestoneChecklistItemsComplete(milestone.id);
    if (!checklistComplete) {
      throw new Error('Complete all checklist items before marking this milestone complete.');
    }
  }

  const completedAtIso = new Date().toISOString();
  await setProjectMilestoneCompletion({
    milestoneId: milestone.id,
    isCompleted: true,
    completedAtIso,
  });

  try {
    return await createMilestoneInvoice({
      ...input,
      milestoneId: milestone.id,
      milestoneTitle: milestone.title,
      milestoneAmountType: milestone.amount_type,
      milestoneAmountValue: milestone.amount_value,
      milestoneCompletionMode: milestone.completion_mode,
      milestoneCompletedAtIso: completedAtIso,
      markAttachedSessionsInvoiced:
        input.markAttachedSessionsInvoiced === undefined ? true : input.markAttachedSessionsInvoiced,
      status: input.status ?? 'draft',
      sessionIds: input.sessionIds ?? [],
      hourlyRateForSessionAppendix: input.hourlyRateForSessionAppendix,
    });
  } catch (error) {
    // Best effort rollback to keep milestone state aligned if invoice creation fails.
    await setProjectMilestoneCompletion({
      milestoneId: milestone.id,
      isCompleted: false,
      completedAtIso: null,
    }).catch(() => undefined);
    throw error;
  }
}
