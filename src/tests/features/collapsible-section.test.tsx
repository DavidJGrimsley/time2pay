import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
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
}));

vi.mock('@expo/vector-icons', () => ({
  Octicons: makeComponent('Octicons'),
}));

vi.mock('uniwind', () => ({
  useUniwind: () => ({ theme: 'light', hasAdaptiveThemes: true }),
}));

describe('CollapsibleSection', () => {
  it('starts collapsed by default and does not render children', async () => {
    const { CollapsibleSection } = await import('@/features/settings/collapsible-section');

    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(
        <CollapsibleSection title="Preferences">
          <Text>Section content</Text>
        </CollapsibleSection>,
      );
    });

    expect(
      root.root.findAll(
        (node: renderer.ReactTestInstance) => String(node.type) === 'Text' && node.props.children === 'Section content',
      ),
    ).toHaveLength(0);
  });

  it('expands to reveal children when the header is pressed', async () => {
    const { CollapsibleSection } = await import('@/features/settings/collapsible-section');

    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(
        <CollapsibleSection title="Preferences">
          <Text>Section content</Text>
        </CollapsibleSection>,
      );
    });

    const header = root.root.find(
      (node: renderer.ReactTestInstance) => String(node.type) === 'Pressable',
    );
    await act(async () => {
      header.props.onPress();
    });

    expect(
      root.root.find(
        (node: renderer.ReactTestInstance) => String(node.type) === 'Text' && node.props.children === 'Section content',
      ),
    ).toBeTruthy();
  });

  it('collapses again on a second press', async () => {
    const { CollapsibleSection } = await import('@/features/settings/collapsible-section');

    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(
        <CollapsibleSection title="Preferences" defaultExpanded>
          <Text>Section content</Text>
        </CollapsibleSection>,
      );
    });

    const header = root.root.find(
      (node: renderer.ReactTestInstance) => String(node.type) === 'Pressable',
    );
    await act(async () => {
      header.props.onPress();
    });

    expect(
      root.root.findAll(
        (node: renderer.ReactTestInstance) => String(node.type) === 'Text' && node.props.children === 'Section content',
      ),
    ).toHaveLength(0);
  });
});
