import { useCallback, useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';
import { getUserProfile, initializeDatabase, upsertUserProfile } from '@/database/db';
import {
  deleteMercuryApiKey,
  getMercuryCredentialStatus,
  saveMercuryApiKey,
  setMercuryArAccess,
  testMercuryApiKey,
  type MercuryCredentialStatus,
} from '@/services/mercury-credentials';
import { getCurrentGitHubSessionState, type GitHubSessionState } from '@/services/github-auth';
import { isHostedMode } from '@/services/runtime-mode';
import { showActionErrorAlert, showSystemConfirm, showValidationAlert } from '@/services/system-alert';
import { useAuthUiStore } from '@/stores/auth-ui-store';
import type { NoticeTone } from '@/components/inline-notice';
import {
  GITHUB_OAUTH_AUTHORIZE_URL,
  GITHUB_OAUTH_SCOPE,
  GITHUB_OAUTH_STATE_KEY,
  getGitHubOAuthClientId,
  isGitHubOAuthEnabled as computeIsGitHubOAuthEnabled,
  resolveGitHubOAuthRedirectUri,
} from './github-oauth-shared';

type IntegrationsStatus = { message: string; tone: NoticeTone } | null;

export function useIntegrationsScreen() {
  const tourModeEnabled = useAuthUiStore((state) => state.tourModeEnabled);
  const isAuthenticated = useAuthUiStore((state) => state.isAuthenticated);
  const shouldRouteAuthIntegrationsToSignIn = isHostedMode() && tourModeEnabled;
  const shouldShowHostedMercuryCredentials = isHostedMode() && isAuthenticated && !tourModeEnabled;

  const [isLoading, setIsLoading] = useState(true);
  const [isSavingIntegrations, setIsSavingIntegrations] = useState(false);
  const [generalStatus, setGeneralStatus] = useState<IntegrationsStatus>(null);
  const [githubStatus, setGitHubStatus] = useState<IntegrationsStatus>(null);
  const [mercuryStatus, setMercuryStatus] = useState<IntegrationsStatus>(null);

  const [githubPat, setGithubPat] = useState('');
  const [showAdvancedGitHubOptions, setShowAdvancedGitHubOptions] = useState(false);
  const [showPatInfoModal, setShowPatInfoModal] = useState(false);
  const [isSigningInWithGitHub, setIsSigningInWithGitHub] = useState(false);
  const [githubSessionState, setGitHubSessionState] = useState<GitHubSessionState>({
    isGitHubSession: false,
    providerToken: null,
    displayName: null,
  });

  const [mercuryApiKey, setMercuryApiKey] = useState('');
  const [mercuryCredentialStatus, setMercuryCredentialStatus] =
    useState<MercuryCredentialStatus | null>(null);
  const [isSavingMercuryKey, setIsSavingMercuryKey] = useState(false);
  const [isTestingMercuryKey, setIsTestingMercuryKey] = useState(false);
  const [isTogglingMercuryAr, setIsTogglingMercuryAr] = useState(false);
  const [isDeletingMercuryKey, setIsDeletingMercuryKey] = useState(false);

  const githubClientId = getGitHubOAuthClientId();
  const isGitHubOAuthEnabled = computeIsGitHubOAuthEnabled();
  const hasSavedGitHubToken = githubPat.trim().length > 0;
  const hasGitHubSessionToken =
    githubSessionState.isGitHubSession && Boolean(githubSessionState.providerToken?.trim());
  const hasGitHubRepoAccess = hasGitHubSessionToken || hasSavedGitHubToken;
  const shouldShowManualGitHubSyncButton =
    isGitHubOAuthEnabled &&
    !hasSavedGitHubToken &&
    (!githubSessionState.isGitHubSession || !githubSessionState.providerToken);

  const loadGitHubPat = useCallback(async (): Promise<void> => {
    const profile = await getUserProfile();
    setGithubPat(profile.github_pat ?? '');
  }, []);

  const refreshGitHubSessionState = useCallback(async (): Promise<void> => {
    setGitHubSessionState(await getCurrentGitHubSessionState());
  }, []);

  const refreshMercuryCredentialStatus = useCallback(async (): Promise<void> => {
    if (!shouldShowHostedMercuryCredentials) {
      setMercuryCredentialStatus(null);
      setMercuryStatus(null);
      return;
    }

    try {
      setMercuryCredentialStatus(await getMercuryCredentialStatus());
    } catch (error: unknown) {
      setMercuryCredentialStatus({
        configured: false,
        keyLastFour: null,
        updatedAt: null,
        arAccessAvailable: null,
        arAccessVerifiedAt: null,
      });
      setMercuryStatus({
        message:
          error instanceof Error
            ? error.message
            : 'Failed to load Mercury credential status.',
        tone: 'error',
      });
      if (typeof console !== 'undefined' && typeof console.warn === 'function') {
        console.warn('Failed to load Mercury credential status:', error);
      }
    }
  }, [shouldShowHostedMercuryCredentials]);

  useEffect(() => {
    initializeDatabase()
      .then(async () => {
        const [githubPatResult, githubSessionResult, mercuryResult] = await Promise.allSettled([
          loadGitHubPat(),
          refreshGitHubSessionState(),
          refreshMercuryCredentialStatus(),
        ]);

        for (const result of [githubPatResult, githubSessionResult, mercuryResult]) {
          if (result.status === 'rejected' && typeof console !== 'undefined') {
            console.warn('Failed to load integrations data:', result.reason);
          }
        }
      })
      .catch((error: unknown) => {
        setGeneralStatus({
          message: error instanceof Error ? error.message : 'Failed to load integrations.',
          tone: 'error',
        });
      })
      .finally(() => setIsLoading(false));
  }, [loadGitHubPat, refreshGitHubSessionState, refreshMercuryCredentialStatus]);

  function openExternalUrl(url: string, options?: { authRelated?: boolean }): void {
    if (options?.authRelated && shouldRouteAuthIntegrationsToSignIn) {
      setGitHubStatus({
        tone: 'neutral',
        message: 'Sign in to connect GitHub and open the PAT setup pages.',
      });
      return;
    }

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }

    Linking.openURL(url).catch(() => undefined);
  }

  function startGitHubOAuth(): void {
    if (shouldRouteAuthIntegrationsToSignIn) {
      setGitHubStatus({
        tone: 'neutral',
        message: 'Sign in to connect your GitHub account.',
      });
      return;
    }

    if (!isGitHubOAuthEnabled || typeof window === 'undefined') {
      return;
    }

    const clientId = githubClientId;
    if (!clientId) {
      return;
    }

    const oauthState = `gh_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    window.sessionStorage.setItem(GITHUB_OAUTH_STATE_KEY, oauthState);
    const redirectUri = resolveGitHubOAuthRedirectUri();
    if (!redirectUri) {
      setGitHubStatus({
        message: 'GitHub OAuth is unavailable: no valid redirect URL is configured.',
        tone: 'error',
      });
      return;
    }

    setGitHubStatus(null);
    setIsSigningInWithGitHub(true);
    setGitHubStatus({
      tone: 'neutral',
      message: 'Redirecting to GitHub so you can approve repository sync.',
    });

    const authorizeUrl = new URL(GITHUB_OAUTH_AUTHORIZE_URL);
    authorizeUrl.searchParams.set('client_id', clientId);
    authorizeUrl.searchParams.set('redirect_uri', redirectUri);
    authorizeUrl.searchParams.set('scope', GITHUB_OAUTH_SCOPE);
    authorizeUrl.searchParams.set('state', oauthState);

    try {
      window.location.assign(authorizeUrl.toString());
    } catch (error) {
      setIsSigningInWithGitHub(false);
      setGitHubStatus({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to open GitHub OAuth.',
      });
    }
  }

  async function handleSaveIntegrations(): Promise<void> {
    setGitHubStatus(null);
    setIsSavingIntegrations(true);

    try {
      await upsertUserProfile({ github_pat: githubPat.trim() ? githubPat.trim() : null });
      await loadGitHubPat();
      setGitHubStatus({ message: 'Integrations saved.', tone: 'success' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save integrations.';
      showActionErrorAlert(message);
      setGitHubStatus({ message, tone: 'error' });
    } finally {
      setIsSavingIntegrations(false);
    }
  }

  async function handleSaveMercuryKey(): Promise<void> {
    setMercuryStatus(null);
    const apiKey = mercuryApiKey.trim();
    if (!apiKey) {
      const message = 'Mercury API key is required.';
      showValidationAlert(message);
      setMercuryStatus({ message, tone: 'error' });
      return;
    }

    setIsSavingMercuryKey(true);
    try {
      const nextStatus = await saveMercuryApiKey(apiKey);
      setMercuryCredentialStatus(nextStatus);
      setMercuryApiKey('');
      setMercuryStatus({ message: 'Mercury API key saved and verified.', tone: 'success' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save Mercury API key.';
      showActionErrorAlert(message);
      setMercuryStatus({ message, tone: 'error' });
    } finally {
      setIsSavingMercuryKey(false);
    }
  }

  async function handleTestMercuryKey(): Promise<void> {
    setMercuryStatus(null);
    setIsTestingMercuryKey(true);

    try {
      await testMercuryApiKey();
      await refreshMercuryCredentialStatus();
      setMercuryStatus({ message: 'Mercury API key connected successfully.', tone: 'success' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to test Mercury API key.';
      showActionErrorAlert(message);
      setMercuryStatus({ message, tone: 'error' });
    } finally {
      setIsTestingMercuryKey(false);
    }
  }

  async function handleToggleMercuryArAccess(enabled: boolean): Promise<void> {
    setMercuryStatus(null);
    setIsTogglingMercuryAr(true);

    try {
      const nextStatus = await setMercuryArAccess(enabled);
      setMercuryCredentialStatus(nextStatus);
      const message = enabled
        ? 'Mercury invoicing enabled. Mercury is now available on Invoices.'
        : 'Mercury invoicing disabled.';
      setMercuryStatus({ message, tone: 'success' });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to update Mercury invoicing setting.';
      showActionErrorAlert(message);
      setMercuryStatus({ message, tone: 'error' });
    } finally {
      setIsTogglingMercuryAr(false);
    }
  }

  async function handleDeleteMercuryKey(): Promise<void> {
    setMercuryStatus(null);
    const confirmed = await showSystemConfirm({
      title: 'Delete Mercury API key?',
      message: 'This removes the saved Mercury key from your Time2Pay hosted profile.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
    });

    if (!confirmed) {
      return;
    }

    setIsDeletingMercuryKey(true);
    try {
      await deleteMercuryApiKey();
      setMercuryCredentialStatus({
        configured: false,
        keyLastFour: null,
        updatedAt: null,
        arAccessAvailable: null,
        arAccessVerifiedAt: null,
      });
      setMercuryApiKey('');
      setMercuryStatus({ message: 'Mercury API key deleted.', tone: 'success' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete Mercury API key.';
      showActionErrorAlert(message);
      setMercuryStatus({ message, tone: 'error' });
    } finally {
      setIsDeletingMercuryKey(false);
    }
  }

  return {
    isLoading,
    isSavingIntegrations,
    generalStatus,
    githubStatus,
    mercuryStatus,
    tourModeEnabled,
    shouldShowHostedMercuryCredentials,
    githubPat,
    setGithubPat,
    showAdvancedGitHubOptions,
    setShowAdvancedGitHubOptions,
    showPatInfoModal,
    setShowPatInfoModal,
    isSigningInWithGitHub,
    isGitHubOAuthEnabled,
    hasGitHubRepoAccess,
    shouldShowManualGitHubSyncButton,
    mercuryApiKey,
    setMercuryApiKey,
    mercuryCredentialStatus,
    isSavingMercuryKey,
    isTestingMercuryKey,
    isTogglingMercuryAr,
    isDeletingMercuryKey,
    openExternalUrl,
    startGitHubOAuth,
    handleSaveIntegrations: () => {
      handleSaveIntegrations().catch(() => undefined);
    },
    handleSaveMercuryKey: () => {
      handleSaveMercuryKey().catch(() => undefined);
    },
    handleTestMercuryKey: () => {
      handleTestMercuryKey().catch(() => undefined);
    },
    handleToggleMercuryArAccess: (enabled: boolean) => {
      handleToggleMercuryArAccess(enabled).catch(() => undefined);
    },
    handleDeleteMercuryKey: () => {
      handleDeleteMercuryKey().catch(() => undefined);
    },
  };
}
