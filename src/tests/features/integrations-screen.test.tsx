import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  isAuthenticated: true,
  tourModeEnabled: false,
  isHostedMode: true,
  getUserProfile: vi.fn(),
  upsertUserProfile: vi.fn(),
  initializeDatabase: vi.fn(),
  getCurrentGitHubSessionState: vi.fn(),
  getMercuryCredentialStatus: vi.fn(),
  saveMercuryApiKey: vi.fn(),
  deleteMercuryApiKey: vi.fn(),
  testMercuryApiKey: vi.fn(),
  setMercuryArAccess: vi.fn(),
  showActionErrorAlert: vi.fn(),
  showSystemConfirm: vi.fn(),
  showValidationAlert: vi.fn(),
}));

function makeComponent(name: string) {
  function Component({ children, ...props }: { children?: React.ReactNode }) {
    return React.createElement(name, props, children);
  }
  Component.displayName = name;
  return Component;
}

vi.mock('react-native', () => ({
  Image: makeComponent('Image'),
  Linking: { openURL: vi.fn() },
  Modal: makeComponent('Modal'),
  Pressable: makeComponent('Pressable'),
  ScrollView: makeComponent('ScrollView'),
  Text: makeComponent('Text'),
  TextInput: makeComponent('TextInput'),
  View: makeComponent('View'),
  Platform: { OS: 'web' },
}));

vi.mock('@expo/vector-icons', () => ({
  Octicons: makeComponent('Octicons'),
}));

vi.mock('expo-router', () => ({
  Link: ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}));

vi.mock('@/database/db', () => ({
  getUserProfile: mocks.getUserProfile,
  upsertUserProfile: mocks.upsertUserProfile,
  initializeDatabase: mocks.initializeDatabase,
}));

vi.mock('@/services/github-auth', () => ({
  getCurrentGitHubSessionState: mocks.getCurrentGitHubSessionState,
}));

vi.mock('@/services/mercury-credentials', () => ({
  getMercuryCredentialStatus: mocks.getMercuryCredentialStatus,
  saveMercuryApiKey: mocks.saveMercuryApiKey,
  deleteMercuryApiKey: mocks.deleteMercuryApiKey,
  testMercuryApiKey: mocks.testMercuryApiKey,
  setMercuryArAccess: mocks.setMercuryArAccess,
}));

vi.mock('@/services/system-alert', () => ({
  showActionErrorAlert: mocks.showActionErrorAlert,
  showSystemConfirm: mocks.showSystemConfirm,
  showValidationAlert: mocks.showValidationAlert,
}));

vi.mock('@/services/runtime-mode', () => ({
  isHostedMode: () => mocks.isHostedMode,
}));

vi.mock('@/services/runtime-config', () => ({
  readTrimmedPublicRuntimeConfigValue: () => 'test-client-id',
}));

vi.mock('@/services/site-origin', () => ({
  requireConfiguredSiteOrigin: vi.fn(),
  resolveBrowserSiteOrigin: () => 'https://example.test',
}));

vi.mock('@/stores/auth-ui-store', () => ({
  useAuthUiStore: (selector: (state: { isAuthenticated: boolean; tourModeEnabled: boolean }) => unknown) =>
    selector({ isAuthenticated: mocks.isAuthenticated, tourModeEnabled: mocks.tourModeEnabled }),
}));

describe('IntegrationsScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.EXPO_OS = 'web';
    mocks.isAuthenticated = true;
    mocks.tourModeEnabled = false;
    mocks.isHostedMode = true;
    mocks.getUserProfile.mockResolvedValue({ github_pat: null });
    mocks.initializeDatabase.mockResolvedValue(undefined);
    mocks.getCurrentGitHubSessionState.mockResolvedValue({
      isGitHubSession: false,
      providerToken: null,
      displayName: null,
    });
    mocks.getMercuryCredentialStatus.mockResolvedValue({
      configured: false,
      keyLastFour: null,
      updatedAt: null,
      arAccessAvailable: null,
      arAccessVerifiedAt: null,
    });
    mocks.upsertUserProfile.mockResolvedValue(undefined);
    mocks.saveMercuryApiKey.mockResolvedValue({
      configured: true,
      keyLastFour: '1234',
      updatedAt: '2026-09-02T00:00:00.000Z',
      arAccessAvailable: false,
      arAccessVerifiedAt: null,
    });
    mocks.showSystemConfirm.mockResolvedValue(true);
  });

  it('renders the GitHub sync entry point', async () => {
    const { IntegrationsScreen } = await import('@/features/settings/integrations/integrations-screen');

    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(<IntegrationsScreen />);
    });

    expect(
      root.root.find(
        (node: renderer.ReactTestInstance) =>
          String(node.type) === 'Text' && node.props.children === 'Sync repositories from GitHub',
      ),
    ).toBeTruthy();
  });

  it('shows the Mercury key section for hosted, authenticated accounts', async () => {
    const { IntegrationsScreen } = await import('@/features/settings/integrations/integrations-screen');

    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(<IntegrationsScreen />);
    });

    expect(
      root.root.find(
        (node: renderer.ReactTestInstance) =>
          String(node.type) === 'Text' && node.props.children === 'Mercury production API key',
      ),
    ).toBeTruthy();
  });

  it('hides the Mercury key section for tour mode', async () => {
    mocks.isHostedMode = true;
    mocks.tourModeEnabled = true;
    mocks.isAuthenticated = false;
    const { IntegrationsScreen } = await import('@/features/settings/integrations/integrations-screen');

    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(<IntegrationsScreen />);
    });

    expect(
      root.root.findAll(
        (node: renderer.ReactTestInstance) =>
          String(node.type) === 'Text' && node.props.children === 'Mercury production API key',
      ),
    ).toHaveLength(0);
  });

  it('renders an initialization failure above both provider cards', async () => {
    mocks.initializeDatabase.mockRejectedValue(new Error('Unable to initialize integrations.'));
    const { IntegrationsScreen } = await import('@/features/settings/integrations/integrations-screen');

    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(<IntegrationsScreen />);
    });

    const mercuryCard = root.root.findByProps({ testID: 'mercury-integration-card' });
    const githubCard = root.root.findByProps({ testID: 'github-integration-card' });
    const noticeMatcher = (node: renderer.ReactTestInstance) =>
      String(node.type) === 'Text' && node.props.children === 'Unable to initialize integrations.';

    expect(root.root.findAll(noticeMatcher)).toHaveLength(1);
    expect(githubCard.findAll(noticeMatcher)).toHaveLength(0);
    expect(mercuryCard.findAll(noticeMatcher)).toHaveLength(0);
  });

  it('renders a Mercury save failure in the Mercury card, not the GitHub card', async () => {
    mocks.saveMercuryApiKey.mockRejectedValue(new Error('Mercury key was rejected.'));
    const { IntegrationsScreen } = await import('@/features/settings/integrations/integrations-screen');

    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(<IntegrationsScreen />);
    });

    const mercuryInput = root.root.find(
      (node: renderer.ReactTestInstance) =>
        String(node.type) === 'TextInput' && node.props.placeholder === 'Mercury production API key',
    );
    await act(async () => {
      mercuryInput.props.onChangeText('mercury-key');
    });

    const saveMercuryButton = root.root.find(
      (node: renderer.ReactTestInstance) =>
        String(node.type) === 'Pressable' &&
        node.findAll(
          (child: renderer.ReactTestInstance) =>
            String(child.type) === 'Text' && child.props.children === 'Save Mercury Key',
        ).length > 0,
    );
    await act(async () => {
      saveMercuryButton.props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    const mercuryCard = root.root.findByProps({ testID: 'mercury-integration-card' });
    const githubCard = root.root.findByProps({ testID: 'github-integration-card' });
    const noticeMatcher = (node: renderer.ReactTestInstance) =>
      String(node.type) === 'Text' && node.props.children === 'Mercury key was rejected.';

    expect(mocks.showActionErrorAlert).toHaveBeenCalledWith('Mercury key was rejected.');
    expect(mercuryCard.findAll(noticeMatcher)).toHaveLength(1);
    expect(githubCard.findAll(noticeMatcher)).toHaveLength(0);
  });

  it('renders a GitHub save failure in the GitHub card, not the Mercury card', async () => {
    mocks.upsertUserProfile.mockRejectedValue(new Error('GitHub token could not be saved.'));
    const { IntegrationsScreen } = await import('@/features/settings/integrations/integrations-screen');

    let root!: renderer.ReactTestRenderer;
    await act(async () => {
      root = renderer.create(<IntegrationsScreen />);
    });

    const advancedOptionsButton = root.root.find(
      (node: renderer.ReactTestInstance) =>
        String(node.type) === 'Pressable' &&
        node.findAll(
          (child: renderer.ReactTestInstance) =>
            String(child.type) === 'Text' &&
            child.props.children === 'Advanced GitHub token options',
        ).length > 0,
    );
    await act(async () => {
      advancedOptionsButton.props.onPress();
    });

    const saveGitHubButton = root.root.find(
      (node: renderer.ReactTestInstance) =>
        String(node.type) === 'Pressable' &&
        node.findAll(
          (child: renderer.ReactTestInstance) =>
            String(child.type) === 'Text' && child.props.children === 'Save Integrations',
        ).length > 0,
    );
    await act(async () => {
      saveGitHubButton.props.onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    const mercuryCard = root.root.findByProps({ testID: 'mercury-integration-card' });
    const githubCard = root.root.findByProps({ testID: 'github-integration-card' });
    const noticeMatcher = (node: renderer.ReactTestInstance) =>
      String(node.type) === 'Text' && node.props.children === 'GitHub token could not be saved.';

    expect(mocks.showActionErrorAlert).toHaveBeenCalledWith('GitHub token could not be saved.');
    expect(githubCard.findAll(noticeMatcher)).toHaveLength(1);
    expect(mercuryCard.findAll(noticeMatcher)).toHaveLength(0);
  });
});
