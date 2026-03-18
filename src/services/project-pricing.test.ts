/* eslint-disable import/first */
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/database/db', () => ({
  areMilestoneChecklistItemsComplete: vi.fn(),
  createProjectMilestone: vi.fn(),
  getProjectMilestoneById: vi.fn(),
  listProjectMilestones: vi.fn(),
  setProjectMilestoneCompletion: vi.fn(),
}));

vi.mock('@/services/invoice', () => ({
  createMilestoneInvoice: vi.fn(),
}));
import {
  canMilestoneBeCompleted,
  getPercentTotalWarning,
  sumPercentMilestones,
} from '@/services/project-pricing';
import type { MilestoneChecklistItem, ProjectMilestone } from '@/database/db';

function buildMilestone(overrides: Partial<ProjectMilestone> = {}): ProjectMilestone {
  return {
    id: 'milestone_1',
    project_id: 'project_1',
    title: 'Milestone 1',
    amount_type: 'percent',
    amount_value: 50,
    completion_mode: 'toggle',
    due_note: null,
    sort_order: 0,
    is_completed: 0,
    completed_at: null,
    created_at: '2026-03-18T10:00:00.000Z',
    updated_at: '2026-03-18T10:00:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

function buildChecklistItem(overrides: Partial<MilestoneChecklistItem> = {}): MilestoneChecklistItem {
  return {
    id: 'checklist_1',
    milestone_id: 'milestone_1',
    label: 'Do work',
    sort_order: 0,
    is_completed: 0,
    completed_at: null,
    created_at: '2026-03-18T10:00:00.000Z',
    updated_at: '2026-03-18T10:00:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

describe('project-pricing percent warnings', () => {
  it('sums percent milestones', () => {
    const total = sumPercentMilestones([
      buildMilestone({ amount_value: 50 }),
      buildMilestone({ id: 'milestone_2', amount_value: 25 }),
      buildMilestone({ id: 'milestone_3', amount_value: 25 }),
    ]);

    expect(total).toBe(100);
  });

  it('warns when percent total is not 100', () => {
    const warning = getPercentTotalWarning([
      buildMilestone({ amount_value: 40 }),
      buildMilestone({ id: 'milestone_2', amount_value: 30 }),
    ]);

    expect(warning).toContain('70.00%');
  });

  it('returns null warning when percent milestones total 100', () => {
    const warning = getPercentTotalWarning([
      buildMilestone({ amount_value: 60 }),
      buildMilestone({ id: 'milestone_2', amount_value: 40 }),
    ]);

    expect(warning).toBeNull();
  });
});

describe('canMilestoneBeCompleted', () => {
  it('allows toggle milestones without checklist items', () => {
    const result = canMilestoneBeCompleted({
      milestone: buildMilestone({ completion_mode: 'toggle' }),
      checklistItems: [],
    });

    expect(result).toBe(true);
  });

  it('requires all checklist items completed for checklist milestones', () => {
    const milestone = buildMilestone({ completion_mode: 'checklist' });
    const incomplete = [
      buildChecklistItem({ id: 'checklist_1', is_completed: 1 }),
      buildChecklistItem({ id: 'checklist_2', is_completed: 0 }),
    ];
    const complete = [
      buildChecklistItem({ id: 'checklist_1', is_completed: 1 }),
      buildChecklistItem({ id: 'checklist_2', is_completed: 1 }),
    ];

    expect(canMilestoneBeCompleted({ milestone, checklistItems: incomplete })).toBe(false);
    expect(canMilestoneBeCompleted({ milestone, checklistItems: complete })).toBe(true);
  });
});
