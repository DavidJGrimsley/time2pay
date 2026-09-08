import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  milestone: {
    id: 'milestone_1',
    project_id: 'project-1',
    title: 'Launch',
    amount_type: 'fixed' as const,
    amount_value: 250,
    completion_mode: 'toggle' as const,
    due_note: null,
    sort_order: 0,
    is_completed: 0,
    completed_at: null,
    created_at: '2026-09-01T12:00:00.000Z',
    updated_at: '2026-09-01T12:00:00.000Z',
    deleted_at: null,
  },
}));

function makeComponent(name: string) {
  function Component({ children, ...props }: { children?: React.ReactNode }) {
    return React.createElement(name, props, children);
  }
  Component.displayName = name;
  return Component;
}

vi.mock('react-native', () => ({
  Pressable: makeComponent('Pressable'),
  Text: makeComponent('Text'),
  TextInput: makeComponent('TextInput'),
  View: makeComponent('View'),
}));

vi.mock('@/database/db', () => ({
  createMilestoneChecklistItem: vi.fn(),
  initializeDatabase: vi.fn().mockResolvedValue(undefined),
  listInvoices: vi.fn().mockResolvedValue([]),
  listMilestoneChecklistItemsByMilestoneIds: vi.fn().mockResolvedValue([]),
  listProjectMilestones: vi.fn().mockResolvedValue([mocks.milestone]),
  updateMilestoneChecklistItem: vi.fn(),
}));

vi.mock('@/hooks/use-stable-window-dimensions', () => ({
  useStableWindowDimensions: () => ({ width: 1280, height: 900 }),
}));

vi.mock('@/services/project-pricing', () => ({
  canMilestoneBeCompleted: () => true,
  setDashboardMilestoneCompletion: vi.fn(),
}));

describe('DashboardMilestones', () => {
  it('renders inline milestones and delegates add/edit actions to the Dashboard editor', async () => {
    const onAdd = vi.fn();
    const onEdit = vi.fn();
    const { DashboardMilestones } = await import('@/components/dashboard-milestones');

    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(
        <DashboardMilestones
          projectId="project-1"
          projectName="Website"
          onAdd={onAdd}
          onEdit={onEdit}
        />,
      );
    });

    const rendered = JSON.stringify(root.toJSON());
    expect(rendered).toContain('Milestones');
    expect(rendered).toContain('For Website');
    expect(rendered).toContain('Launch');
    expect(rendered).toContain('$250.00');

    const add = root.root.find(
      (node: renderer.ReactTestInstance) =>
        String(node.type) === 'Pressable' && node.props.accessibilityLabel === 'Add milestone',
    );
    const edit = root.root.find(
      (node: renderer.ReactTestInstance) =>
        String(node.type) === 'Pressable' && node.props.accessibilityLabel === 'Edit Launch',
    );
    await act(async () => {
      add.props.onPress();
      edit.props.onPress();
    });

    expect(onAdd).toHaveBeenCalledOnce();
    expect(onEdit).toHaveBeenCalledWith('milestone_1');
  });

  it('keeps the inline card available when no project is selected', async () => {
    const { DashboardMilestones } = await import('@/components/dashboard-milestones');
    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(<DashboardMilestones projectId={null} projectName={null} />);
    });

    expect(JSON.stringify(root.toJSON())).toContain('Choose a customer and project in the time tracker first.');
  });
});
