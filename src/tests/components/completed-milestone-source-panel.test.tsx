import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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
  View: makeComponent('View'),
  useColorScheme: () => 'dark',
}));

describe('CompletedMilestoneSourcePanel', () => {
  it('keeps the Mercury review-surface heading readable in dark mode', async () => {
    const { CompletedMilestoneSourcePanel } = await import('@/components/completed-milestone-source-panel');
    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(
        <CompletedMilestoneSourcePanel
          selectedIds={['milestone_1']}
          onToggle={vi.fn()}
          sources={[
            {
              milestone: { id: 'milestone_1', title: 'Project start' },
              projectName: 'Warehouse',
              amount: 500,
            },
          ] as never}
        />,
      );
    });

    const heading = root.root.find(
      (node: renderer.ReactTestInstance) => String(node.type) === 'Text' && node.props.children === 'Completed milestones',
    );
    expect(heading.props.style).toEqual({ color: '#1A1F16' });
  });
});
