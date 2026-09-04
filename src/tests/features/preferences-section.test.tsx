import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  appearancePreference: 'system' as 'light' | 'dark' | 'system',
  setAppearancePreference: vi.fn(),
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
  View: makeComponent('View'),
}));

vi.mock('@/stores/appearance-store', () => ({
  useAppearanceUiStore: (
    selector: (state: { appearancePreference: string; setAppearancePreference: (value: string) => void }) => unknown,
  ) =>
    selector({
      appearancePreference: mocks.appearancePreference,
      setAppearancePreference: mocks.setAppearancePreference,
    }),
}));

describe('PreferencesSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.appearancePreference = 'system';
  });

  it('renders all three appearance options', async () => {
    const { PreferencesSection } = await import('@/features/settings/preferences/preferences-section');

    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(<PreferencesSection />);
    });

    const labels = root.root
      .findAll((node: renderer.ReactTestInstance) => String(node.type) === 'Text')
      .map((node) => node.props.children)
      .filter((children) => typeof children === 'string');
    expect(labels).toEqual(expect.arrayContaining(['Light', 'Dark', 'System']));
  });

  it('calls setAppearancePreference when an option is pressed', async () => {
    const { PreferencesSection } = await import('@/features/settings/preferences/preferences-section');

    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(<PreferencesSection />);
    });

    const darkOption = root.root.find(
      (node: renderer.ReactTestInstance) =>
        String(node.type) === 'Pressable' && node.props.accessibilityState?.selected === false && node.props.children?.props?.children === 'Dark',
    );
    await act(async () => {
      darkOption.props.onPress();
    });

    expect(mocks.setAppearancePreference).toHaveBeenCalledWith('dark');
  });
});
