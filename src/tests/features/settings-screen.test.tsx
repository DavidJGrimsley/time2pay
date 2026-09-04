import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  isAuthenticated: true,
  tourModeEnabled: false,
  isHostedMode: true,
  isProfileComplete: true,
  getUserProfile: vi.fn(),
  upsertUserProfile: vi.fn(),
  initializeDatabase: vi.fn(),
  getProfileCompletion: vi.fn(),
  getMercuryReferralStatus: vi.fn(),
  signOutSupabase: vi.fn(),
}));

function makeComponent(name: string) {
  function Component({ children, ...props }: { children?: React.ReactNode }) {
    return React.createElement(name, props, children);
  }
  Component.displayName = name;
  return Component;
}

vi.mock('react-native', async () => ({
  ActivityIndicator: makeComponent('ActivityIndicator'),
  Image: makeComponent('Image'),
  Linking: { openURL: vi.fn() },
  Modal: makeComponent('Modal'),
  Pressable: makeComponent('Pressable'),
  ScrollView: makeComponent('ScrollView'),
  Switch: makeComponent('Switch'),
  Text: makeComponent('Text'),
  TextInput: makeComponent('TextInput'),
  View: makeComponent('View'),
  Platform: { OS: 'web' },
}));

vi.mock('@expo/vector-icons', () => ({
  Octicons: makeComponent('Octicons'),
}));

vi.mock('expo-constants', () => ({
  default: { expoConfig: { version: '1.0.0-test' } },
}));

vi.mock('expo-router', () => ({
  Link: ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('uniwind', () => ({
  useUniwind: () => ({ theme: 'light', hasAdaptiveThemes: true }),
  Uniwind: { setTheme: vi.fn() },
}));

vi.mock('@/database/db', () => ({
  getUserProfile: mocks.getUserProfile,
  upsertUserProfile: mocks.upsertUserProfile,
  initializeDatabase: mocks.initializeDatabase,
}));

vi.mock('@/services/profile-completion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/profile-completion')>();
  return {
    ...actual,
    getProfileCompletion: mocks.getProfileCompletion,
  };
});

vi.mock('@/services/mercury-referrals', () => ({
  getMercuryReferralStatus: mocks.getMercuryReferralStatus,
}));

vi.mock('@/services/data-backup', () => ({
  createBackupSnapshot: vi.fn(),
  downloadBackup: vi.fn(),
  formatBackupSummary: vi.fn(() => ''),
  parseAndValidateBackup: vi.fn(),
  restoreBackup: vi.fn(),
}));

vi.mock('@/services/runtime-mode', () => ({
  isHostedMode: () => mocks.isHostedMode,
}));

vi.mock('@/services/runtime-config', () => ({
  readTrimmedPublicRuntimeConfigValue: () => undefined,
}));

vi.mock('@/services/site-origin', () => ({
  requireConfiguredSiteOrigin: vi.fn(),
  resolveBrowserSiteOrigin: () => 'https://example.test',
}));

vi.mock('@/services/supabase-client', () => ({
  signOutSupabase: mocks.signOutSupabase,
}));

vi.mock('@/stores/auth-ui-store', () => ({
  useAuthUiStore: (selector: (state: { isAuthenticated: boolean; tourModeEnabled: boolean }) => unknown) =>
    selector({ isAuthenticated: mocks.isAuthenticated, tourModeEnabled: mocks.tourModeEnabled }),
}));

vi.mock('@/stores/appearance-store', () => ({
  useAppearanceUiStore: (selector: (state: { appearancePreference: string; setAppearancePreference: () => void }) => unknown) =>
    selector({ appearancePreference: 'system', setAppearancePreference: vi.fn() }),
}));

describe('SettingsScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isAuthenticated = true;
    mocks.tourModeEnabled = false;
    mocks.isHostedMode = true;
    mocks.getUserProfile.mockResolvedValue({
      company_name: null,
      logo_url: null,
      full_name: 'Ada Lovelace',
      phone: '555-867-5309',
      email: 'ada@example.com',
      github_pat: null,
    });
    mocks.initializeDatabase.mockResolvedValue(undefined);
    mocks.getProfileCompletion.mockResolvedValue({ isComplete: true, missingFields: [] });
    mocks.getMercuryReferralStatus.mockResolvedValue({
      premiumAccess: false,
      premiumAccessGrantedAt: null,
    });
  });

  it('renders the settings hub without throwing', async () => {
    const { SettingsScreen } = await import('@/features/settings/settings-screen');

    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(<SettingsScreen />);
    });

    expect(
      root.root.find(
        (node: renderer.ReactTestInstance) => String(node.type) === 'Text' && node.props.children === 'Settings',
      ),
    ).toBeTruthy();
  });

  it('uses arrow-only indicators for linked Billing and Integrations cards', async () => {
    const { SettingsScreen } = await import('@/features/settings/settings-screen');

    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(<SettingsScreen />);
    });

    expect(
      root.root.findAll(
        (node: renderer.ReactTestInstance) =>
          String(node.type) === 'Text' &&
          node.props.children === '→' &&
          node.props.className === 'text-3xl leading-none text-secondary',
      ),
    ).toHaveLength(2);
    expect(
      root.root.findAll(
        (node: renderer.ReactTestInstance) =>
          String(node.type) === 'Text' && node.props.children === 'Open →',
      ),
    ).toHaveLength(0);
    expect(
      root.root.findAll(
        (node: renderer.ReactTestInstance) =>
          String(node.type) === 'Pressable' &&
          ((node.props.accessibilityLabel === 'Billing settings' &&
            node.props.accessibilityHint === 'Manage your plan, payment method, and invoices.') ||
            (node.props.accessibilityLabel === 'Integrations settings' &&
              node.props.accessibilityHint ===
                'Connect GitHub repositories and your Mercury account.')),
      ),
    ).toHaveLength(2);
  });

  it('shows the Sign Out action for an authenticated hosted account', async () => {
    const { SettingsScreen } = await import('@/features/settings/settings-screen');

    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(<SettingsScreen />);
    });

    expect(
      root.root.find(
        (node: renderer.ReactTestInstance) => String(node.type) === 'Text' && node.props.children === 'Sign Out',
      ),
    ).toBeTruthy();
  });

  it('hides the Sign Out action when not authenticated', async () => {
    mocks.isAuthenticated = false;
    const { SettingsScreen } = await import('@/features/settings/settings-screen');

    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(<SettingsScreen />);
    });

    expect(
      root.root.findAll(
        (node: renderer.ReactTestInstance) => String(node.type) === 'Text' && node.props.children === 'Sign Out',
      ),
    ).toHaveLength(0);
  });

  it('shows the incomplete-profile banner and auto-expands Your Business when fields are missing', async () => {
    mocks.getProfileCompletion.mockResolvedValue({
      isComplete: false,
      missingFields: ['full_name'],
    });
    const { SettingsScreen } = await import('@/features/settings/settings-screen');

    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(<SettingsScreen />);
    });

    expect(
      root.root.find(
        (node: renderer.ReactTestInstance) =>
          String(node.type) === 'Text' &&
          node.props.children === 'Add your name, phone, and email in Your Business below to start tracking time and invoicing.',
      ),
    ).toBeTruthy();

    // The fields that unblock the profile gate must be visible immediately,
    // not hidden behind a collapsed accordion the user has to discover.
    expect(
      root.root.find(
        (node: renderer.ReactTestInstance) =>
          String(node.type) === 'TextInput' && node.props.placeholder === 'Full name',
      ),
    ).toBeTruthy();
  });

  it('keeps Your Business collapsed by default when the profile is already complete', async () => {
    mocks.getProfileCompletion.mockResolvedValue({ isComplete: true, missingFields: [] });
    const { SettingsScreen } = await import('@/features/settings/settings-screen');

    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(<SettingsScreen />);
    });

    expect(
      root.root.findAll(
        (node: renderer.ReactTestInstance) =>
          String(node.type) === 'TextInput' && node.props.placeholder === 'Full name',
      ),
    ).toHaveLength(0);
  });
});
