import React from 'react';
import renderer from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', async () => {
  const ReactModule = await import('react');
  const makeComponent = (name: string) =>
    ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactModule.createElement(name, props, children);
  return {
    Pressable: makeComponent('Pressable'),
    Text: makeComponent('Text'),
    TextInput: makeComponent('TextInput'),
    View: makeComponent('View'),
  };
});

vi.mock('expo-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/database/db', () => ({
  createProjectMilestone: vi.fn(),
  initializeDatabase: vi.fn().mockResolvedValue(undefined),
  listMilestoneChecklistItemsByMilestoneIds: vi.fn().mockResolvedValue([]),
  listProjectMilestones: vi.fn().mockResolvedValue([]),
  setProjectMilestoneCompletion: vi.fn(),
  updateMilestoneChecklistItem: vi.fn(),
}));

vi.mock('@/hooks/use-stable-window-dimensions', () => ({
  useStableWindowDimensions: () => ({ width: 1280, height: 900 }),
}));

describe('DashboardMilestones', () => {
  it('renders the selected-project milestone section and edit action', async () => {
    const { DashboardMilestones } = await import('@/components/dashboard-milestones');
    const tree = renderer.create(<DashboardMilestones projectId="project-1" projectName="Website" />);
    await renderer.act(async () => {});

    const rendered = JSON.stringify(tree.toJSON());
    expect(rendered).toContain('Milestones');
    expect(rendered).toContain('For Website');
    expect(rendered).toContain('Edit');
    expect(rendered).toContain('Add');
  });
});
