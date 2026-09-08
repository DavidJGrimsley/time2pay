import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  getUserProfile: vi.fn(),
  upsertUserProfile: vi.fn(),
  initializeDatabase: vi.fn(),
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
  getUserProfile: mocks.getUserProfile,
  upsertUserProfile: mocks.upsertUserProfile,
  initializeDatabase: mocks.initializeDatabase,
}));

describe('ProfileBusinessSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.initializeDatabase.mockResolvedValue(undefined);
    mocks.getUserProfile.mockResolvedValue({
      company_name: null,
      logo_url: null,
      full_name: 'Ada Lovelace',
      phone: '555-867-5309',
      email: 'ada@example.com',
      github_pat: null,
    });
  });

  it('loads and renders the saved profile fields', async () => {
    const { ProfileBusinessSection } = await import(
      '@/features/settings/profile-business/profile-business-section'
    );

    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(<ProfileBusinessSection />);
    });

    const fullNameInput = root.root.find(
      (node: renderer.ReactTestInstance) =>
        String(node.type) === 'TextInput' && node.props.placeholder === 'Full name',
    );
    expect(fullNameInput.props.value).toBe('Ada Lovelace');
  });

  it('saves business settings and calls onProfileUpdated', async () => {
    mocks.upsertUserProfile.mockResolvedValue(undefined);
    const onProfileUpdated = vi.fn();
    const { ProfileBusinessSection } = await import(
      '@/features/settings/profile-business/profile-business-section'
    );

    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(<ProfileBusinessSection onProfileUpdated={onProfileUpdated} />);
    });

    const saveButton = root.root.find(
      (node: renderer.ReactTestInstance) => String(node.type) === 'Pressable' && !node.props.disabled,
    );
    await act(async () => {
      saveButton.props.onPress();
    });

    expect(mocks.upsertUserProfile).toHaveBeenCalled();
    expect(onProfileUpdated).toHaveBeenCalled();
  });

  it('shows a validation error for an incomplete phone number on blur', async () => {
    mocks.getUserProfile.mockResolvedValue({
      company_name: null,
      logo_url: null,
      full_name: 'Ada Lovelace',
      phone: '555-123',
      email: 'ada@example.com',
      github_pat: null,
    });
    const { ProfileBusinessSection } = await import(
      '@/features/settings/profile-business/profile-business-section'
    );

    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(<ProfileBusinessSection />);
    });

    const phoneInput = root.root.find(
      (node: renderer.ReactTestInstance) =>
        String(node.type) === 'TextInput' && node.props.placeholder === '555-867-5309',
    );
    await act(async () => {
      phoneInput.props.onBlur();
    });

    expect(
      root.root.find(
        (node: renderer.ReactTestInstance) =>
          String(node.type) === 'Text' &&
          typeof node.props.children === 'string' &&
          node.props.children.includes('10-digit phone number'),
      ),
    ).toBeTruthy();
  });
});
