import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  colorScheme: 'dark' as 'dark' | 'light',
  milestone: {
    id: 'milestone_1',
    project_id: 'project_1',
    title: 'Initial milestone',
    amount_type: 'fixed',
    amount_value: 300,
    completion_mode: 'toggle',
    due_note: null,
    sort_order: 0,
  },
  project: { id: 'project_1', name: 'Hourly project', pricing_mode: 'hourly' },
}));

function makeComponent(name: string) {
  function Component({ children, ...props }: { children?: React.ReactNode }) {
    return React.createElement(name, props, children);
  }
  Component.displayName = name;
  return Component;
}

vi.mock('@expo/ui', () => ({
  BottomSheet: makeComponent('BottomSheet'),
  Host: makeComponent('Host'),
}));

vi.mock('react-native', () => ({
  Pressable: makeComponent('Pressable'),
  ScrollView: makeComponent('ScrollView'),
  Text: makeComponent('Text'),
  TextInput: makeComponent('TextInput'),
  View: makeComponent('View'),
  useColorScheme: () => mocks.colorScheme,
}));

vi.mock('@/components/picker-field', () => ({
  PickerControl: makeComponent('PickerControl'),
}));

vi.mock('@/components/inline-notice', () => ({
  InlineNotice: makeComponent('InlineNotice'),
}));

vi.mock('@/database/db', () => ({
  createProjectMilestone: vi.fn(),
  getProjectById: vi.fn().mockImplementation(() => Promise.resolve(mocks.project)),
  getProjectMilestoneById: vi.fn().mockImplementation(() => Promise.resolve(mocks.milestone)),
  initializeDatabase: vi.fn().mockResolvedValue(undefined),
  listProjectMilestones: vi.fn().mockImplementation(() => Promise.resolve([mocks.milestone])),
  updateProjectMilestone: vi.fn(),
}));

describe('DashboardMilestoneSheet', () => {
  beforeEach(() => {
    mocks.colorScheme = 'dark';
  });

  it('uses a dark native sheet surface and shows an unavailable percentage option for hourly projects', async () => {
    const { DashboardMilestoneSheet } = await import('@/components/dashboard-milestone-sheet');
    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(
        <DashboardMilestoneSheet
          visible
          mode="create"
          projectId="project_1"
          onDismiss={vi.fn()}
        />,
      );
    });

    expect(root.root.findByType('BottomSheet' as never).props.containerColor).toBe('#1A1F16');
    const amountPicker = root.root.findAllByType('PickerControl' as never)[0];
    expect(amountPicker.props.items).toContainEqual({
      label: 'Percentage (disabled on hourly-priced projects)',
      value: 'percent-unavailable',
      disabled: true,
    });
  });

  it('prefills an existing milestone for editing', async () => {
    const { DashboardMilestoneSheet } = await import('@/components/dashboard-milestone-sheet');
    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(
        <DashboardMilestoneSheet
          visible
          mode="edit"
          projectId="project_1"
          milestoneId="milestone_1"
          onDismiss={vi.fn()}
        />,
      );
    });

    const inputs = root.root.findAllByType('TextInput' as never);
    expect(inputs.map((input: renderer.ReactTestInstance) => input.props.value)).toContain('Initial milestone');
    expect(inputs.map((input: renderer.ReactTestInstance) => input.props.value)).toContain('300');
  });
});
