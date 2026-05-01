import { Octicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, Linking, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import {
  getUserProfile,
  initializeDatabase,
  upsertUserProfile,
} from '@/database/db';
import { useStableWindowDimensions } from '@/hooks/use-stable-window-dimensions';
import {
  evaluateProfileCompletion,
  REQUIRED_PROFILE_FIELD_LABELS,
} from '@/services/profile-completion';
import {
  createBackupSnapshot,
  downloadBackup,
  formatBackupSummary,
  parseAndValidateBackup,
  restoreBackup,
} from '@/services/data-backup';
import { getCurrentGitHubSessionState, type GitHubSessionState } from '@/services/github-auth';
import { InlineNotice, type NoticeTone } from '@/components/inline-notice';
import {
  deleteMercuryApiKey,
  getMercuryCredentialStatus,
  saveMercuryApiKey,
  testMercuryApiKey,
  type MercuryCredentialStatus,
} from '@/services/mercury-credentials';
import {
  getMercuryReferralStatus,
  MERCURY_REFERRAL_URL,
  trackMercuryReferralClick,
  type MercuryReferralStatus,
} from '@/services/mercury-referrals';
import { readTrimmedPublicRuntimeConfigValue } from '@/services/runtime-config';
import { isHostedMode } from '@/services/runtime-mode';
import { requireConfiguredSiteOrigin, resolveBrowserSiteOrigin } from '@/services/site-origin';
import { signOutSupabase } from '@/services/supabase-client';
import { showActionErrorAlert, showSystemConfirm, showValidationAlert } from '@/services/system-alert';
import { useAuthUiStore } from '@/stores/auth-ui-store';

const FILE_PICKER_CANCELED_MESSAGE = 'Backup import canceled.';
const GITHUB_PAT_CREATE_URL = 'https://github.com/settings/personal-access-tokens/new';
const GITHUB_PAT_DOCS_URL =
  'https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens';
const GITHUB_OAUTH_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_OAUTH_PROXY_PATH = '/api/github';
const GITHUB_OAUTH_SCOPE = 'repo read:user';
const GITHUB_OAUTH_STATE_KEY = 'time2pay_github_oauth_state';

type StatusNotice = {
  message: string;
  tone: NoticeTone;
};

type ProfileStatusSection = 'business' | 'integrations' | 'backup' | 'general';

type SectionStatusNotice = StatusNotice & {
  section: ProfileStatusSection;
};

type PickedBackupFile = {
  fileName: string;
  text: string;
};

function toNullableTrimmed(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

async function pickBackupJsonFile(): Promise<PickedBackupFile> {
  if (process.env.EXPO_OS !== 'web' || typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('Backup import is only supported in web/PWA mode for now.');
  }

  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';
    document.body.appendChild(input);

    let settled = false;

    const settle = (callback: () => void): void => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      callback();
    };

    const cleanup = (): void => {
      input.onchange = null;
      input.removeEventListener('cancel', handleCancel);
      window.removeEventListener('focus', handleWindowFocus);
      if (input.parentNode) {
        input.parentNode.removeChild(input);
      }
    };

    const handleCancel = (): void => {
      settle(() => reject(new Error(FILE_PICKER_CANCELED_MESSAGE)));
    };

    const handleWindowFocus = (): void => {
      window.setTimeout(() => {
        if (settled) {
          return;
        }

        const selectedFile = input.files?.[0];
        if (!selectedFile) {
          settle(() => reject(new Error(FILE_PICKER_CANCELED_MESSAGE)));
        }
      }, 300);
    };

    input.addEventListener('cancel', handleCancel);
    window.addEventListener('focus', handleWindowFocus);

    input.onchange = () => {
      const selectedFile = input.files?.[0];
      if (!selectedFile) {
        settle(() => reject(new Error(FILE_PICKER_CANCELED_MESSAGE)));
        return;
      }

      selectedFile
        .text()
        .then((text) => {
          settle(() =>
            resolve({
              fileName: selectedFile.name,
              text,
            }),
          );
        })
        .catch(() => {
          settle(() => reject(new Error('Failed to read backup file.')));
        });
    };

    input.click();
  });
}

export function ProfileOverview() {
  const router = useRouter();
  const { width } = useStableWindowDimensions();
  const isLargeScreen = width >= 1200;
  const isTablet = width >= 768 && width < 1200;
  const contentWidthStyle = isLargeScreen
    ? { width: '90%' as const, maxWidth: 1500 }
    : isTablet
      ? { width: '75%' as const }
      : { width: '90%' as const };

  const [isLoading, setIsLoading] = useState(true);
  const [isSavingBusiness, setIsSavingBusiness] = useState(false);
  const [isSavingIntegrations, setIsSavingIntegrations] = useState(false);
  const [isExportingData, setIsExportingData] = useState(false);
  const [isImportingData, setIsImportingData] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [createSafetyBackupBeforeImport, setCreateSafetyBackupBeforeImport] = useState(true);
  const [sectionStatus, setSectionStatus] = useState<SectionStatusNotice | null>(null);

  const [companyName, setCompanyName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [fullName, setFullName] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [githubPat, setGithubPat] = useState('');
  const [mercuryApiKey, setMercuryApiKey] = useState('');
  const [mercuryCredentialStatus, setMercuryCredentialStatus] =
    useState<MercuryCredentialStatus | null>(null);
  const [isSavingMercuryKey, setIsSavingMercuryKey] = useState(false);
  const [isTestingMercuryKey, setIsTestingMercuryKey] = useState(false);
  const [isDeletingMercuryKey, setIsDeletingMercuryKey] = useState(false);
  const [mercuryReferralStatus, setMercuryReferralStatus] =
    useState<MercuryReferralStatus | null>(null);
  const [isOpeningMercuryReferral, setIsOpeningMercuryReferral] = useState(false);
  const [showIntegrations, setShowIntegrations] = useState(true);
  const [showAdvancedGitHubOptions, setShowAdvancedGitHubOptions] = useState(false);
  const [showPatInfoModal, setShowPatInfoModal] = useState(false);
  const [isSigningInWithGitHub, setIsSigningInWithGitHub] = useState(false);
  const [githubSessionState, setGitHubSessionState] = useState<GitHubSessionState>({
    isGitHubSession: false,
    providerToken: null,
    displayName: null,
  });
  const tourModeEnabled = useAuthUiStore((state) => state.tourModeEnabled);
  const isAuthenticated = useAuthUiStore((state) => state.isAuthenticated);
  const shouldRouteAuthIntegrationsToSignIn = isHostedMode() && tourModeEnabled;
  const shouldShowHostedMercuryCredentials = isHostedMode() && isAuthenticated && !tourModeEnabled;

  const githubClientId = readTrimmedPublicRuntimeConfigValue('EXPO_PUBLIC_GITHUB_CLIENT_ID');
  const isGitHubOAuthEnabled = Platform.OS === 'web' && Boolean(githubClientId);
  const hasSavedGitHubToken = githubPat.trim().length > 0;
  const hasGitHubSessionToken =
    githubSessionState.isGitHubSession && Boolean(githubSessionState.providerToken?.trim());
  const hasGitHubRepoAccess = hasGitHubSessionToken || hasSavedGitHubToken;
  const shouldShowManualGitHubSyncButton =
    isGitHubOAuthEnabled &&
    !hasSavedGitHubToken &&
    (!githubSessionState.isGitHubSession || !githubSessionState.providerToken);

  const showStatus = useCallback((section: ProfileStatusSection, notice: StatusNotice): void => {
    setSectionStatus({ section, ...notice });
  }, []);

  const clearSectionStatus = useCallback((section: ProfileStatusSection): void => {
    setSectionStatus((current) => (current?.section === section ? null : current));
  }, []);

  const routeAuthIntegrationsToSignIn = useCallback((): void => {
    showStatus('integrations', {
      tone: 'neutral',
      message: 'Sign in to connect GitHub integrations.',
    });
    router.push('/sign-in' as never);
  }, [router, showStatus]);

  const resolveGitHubOAuthRedirectUri = useCallback((): string | null => {
    if (isHostedMode()) {
      try {
        requireConfiguredSiteOrigin();
        return new URL('/profile', resolveBrowserSiteOrigin()).toString();
      } catch (error) {
        if (typeof console !== 'undefined' && typeof console.error === 'function') {
          console.error(
            'Failed to resolve GitHub OAuth redirect URI from the active site origin:',
            error,
          );
        }
        return null;
      }
    }

    if (typeof window === 'undefined') {
      return null;
    }

    return new URL('/profile', window.location.origin).toString();
  }, []);

  const loadProfileData = useCallback(async (): Promise<void> => {
    const profile = await getUserProfile();
    setCompanyName(profile.company_name ?? '');
    setLogoUrl(profile.logo_url ?? '');
    setFullName(profile.full_name ?? '');
    setBusinessPhone(profile.phone ?? '');
    setBusinessEmail(profile.email ?? '');
    setGithubPat(profile.github_pat ?? '');
  }, []);

  const refreshGitHubSessionState = useCallback(async (): Promise<void> => {
    setGitHubSessionState(await getCurrentGitHubSessionState());
  }, []);

  const refreshMercuryCredentialStatus = useCallback(async (): Promise<void> => {
    if (!shouldShowHostedMercuryCredentials) {
      setMercuryCredentialStatus(null);
      return;
    }

    try {
      setMercuryCredentialStatus(await getMercuryCredentialStatus());
    } catch (error: unknown) {
      setMercuryCredentialStatus({ configured: false, keyLastFour: null, updatedAt: null });
      if (typeof console !== 'undefined' && typeof console.warn === 'function') {
        console.warn('Failed to load Mercury credential status:', error);
      }
    }
  }, [shouldShowHostedMercuryCredentials]);

  const refreshMercuryReferralStatus = useCallback(async (): Promise<void> => {
    if (!shouldShowHostedMercuryCredentials) {
      setMercuryReferralStatus(null);
      return;
    }

    try {
      setMercuryReferralStatus(await getMercuryReferralStatus());
    } catch (error: unknown) {
      setMercuryReferralStatus(null);
      if (typeof console !== 'undefined' && typeof console.warn === 'function') {
        console.warn('Failed to load Mercury referral status:', error);
      }
    }
  }, [shouldShowHostedMercuryCredentials]);

  useEffect(() => {
    initializeDatabase()
      .then(async () => {
        const [profileResult, githubResult, mercuryCredentialResult, mercuryReferralResult] =
          await Promise.allSettled([
          loadProfileData(),
          refreshGitHubSessionState(),
          refreshMercuryCredentialStatus(),
          refreshMercuryReferralStatus(),
        ]);

        for (const result of [githubResult, mercuryCredentialResult, mercuryReferralResult]) {
          if (result.status === 'rejected' && typeof console !== 'undefined') {
            console.warn('Optional profile integration load failed:', result.reason);
          }
        }

        if (profileResult.status === 'rejected') {
          throw profileResult.reason;
        }
      })
      .catch((error: unknown) => {
        showStatus('general', {
          message: error instanceof Error ? error.message : 'Failed to load profile.',
          tone: 'error',
        });
      })
      .finally(() => setIsLoading(false));
  }, [
    loadProfileData,
    refreshGitHubSessionState,
    refreshMercuryCredentialStatus,
    refreshMercuryReferralStatus,
    showStatus,
  ]);

  useEffect(() => {
    if (!isGitHubOAuthEnabled || typeof window === 'undefined') {
      return;
    }

    const url = new URL(window.location.href);
    const oauthCode = url.searchParams.get('code')?.trim() ?? '';
    const oauthError = url.searchParams.get('error')?.trim() ?? '';
    if (!oauthCode && !oauthError) {
      return;
    }

    const clearOAuthQueryParams = (): void => {
      url.searchParams.delete('code');
      url.searchParams.delete('state');
      url.searchParams.delete('error');
      url.searchParams.delete('error_description');
      window.history.replaceState({}, document.title, url.toString());
    };

    if (shouldRouteAuthIntegrationsToSignIn) {
      clearOAuthQueryParams();
      routeAuthIntegrationsToSignIn();
      return;
    }

    if (oauthError) {
      const errorDescription = url.searchParams.get('error_description')?.trim();
      showStatus('integrations', {
        tone: 'error',
        message: errorDescription ? `GitHub OAuth failed: ${errorDescription}` : 'GitHub OAuth failed.',
      });
      clearOAuthQueryParams();
      return;
    }

    const returnedState = url.searchParams.get('state')?.trim() ?? '';
    const expectedState = window.sessionStorage.getItem(GITHUB_OAUTH_STATE_KEY) ?? '';
    if (!returnedState || !expectedState || returnedState !== expectedState) {
      showStatus('integrations', {
        tone: 'error',
        message: 'GitHub OAuth failed: state verification did not match.',
      });
      clearOAuthQueryParams();
      return;
    }

    window.sessionStorage.removeItem(GITHUB_OAUTH_STATE_KEY);
    const redirectUri = resolveGitHubOAuthRedirectUri();
    if (!redirectUri) {
      showStatus('integrations', {
        tone: 'error',
        message: 'GitHub OAuth failed: no valid redirect URL is available.',
      });
      clearOAuthQueryParams();
      return;
    }

    let cancelled = false;
    setIsSigningInWithGitHub(true);
    showStatus('integrations', { tone: 'neutral', message: 'Completing GitHub sign-in...' });

    fetch(GITHUB_OAUTH_PROXY_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: oauthCode,
        redirectUri,
      }),
    })
      .then(async (response) => {
        const payload = (await response.json()) as {
          access_token?: string;
          token_type?: string;
          error?: string;
        };

        if (!response.ok || !payload.access_token) {
          throw new Error(payload.error ?? 'GitHub token exchange failed.');
        }

        const token = payload.access_token.trim();
        await upsertUserProfile({ github_pat: token });
        setGithubPat(token);

        const githubUserResponse = await fetch('https://api.github.com/user', {
          method: 'GET',
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `${payload.token_type ?? 'Bearer'} ${token}`,
          },
        });
        const githubUser = (await githubUserResponse.json()) as {
          login?: string;
          name?: string;
        };

        if (cancelled) {
          return;
        }

        await Promise.all([loadProfileData(), refreshGitHubSessionState()]);
        const display = githubUser.name?.trim() || githubUser.login?.trim() || 'GitHub account';
        showStatus('integrations', {
          tone: 'success',
          message: `GitHub OAuth connected. Token saved for ${display}.`,
        });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'GitHub OAuth failed.';
          showStatus('integrations', { tone: 'error', message });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsSigningInWithGitHub(false);
          clearOAuthQueryParams();
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    isGitHubOAuthEnabled,
    loadProfileData,
    refreshGitHubSessionState,
    resolveGitHubOAuthRedirectUri,
    routeAuthIntegrationsToSignIn,
    shouldRouteAuthIntegrationsToSignIn,
    showStatus,
  ]);

  async function handleSaveBusiness(): Promise<void> {
    clearSectionStatus('business');
    const trimmedFullName = fullName.trim();
    const trimmedBusinessPhone = businessPhone.trim();
    const trimmedBusinessEmail = businessEmail.trim();
    const completion = evaluateProfileCompletion({
      full_name: trimmedFullName,
      phone: trimmedBusinessPhone,
      email: trimmedBusinessEmail,
    });

    if (!completion.isComplete) {
      const missing = completion.missingFields
        .map((field) => REQUIRED_PROFILE_FIELD_LABELS[field])
        .join(', ');
      const message = `Missing required business profile fields: ${missing}.`;
      showValidationAlert(message);
      showStatus('business', { message, tone: 'error' });
      return;
    }

    setIsSavingBusiness(true);
    try {
      await upsertUserProfile({
        company_name: toNullableTrimmed(companyName),
        logo_url: toNullableTrimmed(logoUrl),
        full_name: trimmedFullName,
        phone: trimmedBusinessPhone,
        email: trimmedBusinessEmail,
      });
      await loadProfileData();
      showStatus('business', { message: 'Business profile saved.', tone: 'success' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save business profile.';
      showActionErrorAlert(message);
      showStatus('business', { message, tone: 'error' });
    } finally {
      setIsSavingBusiness(false);
    }
  }

  async function handleSaveIntegrations(): Promise<void> {
    clearSectionStatus('integrations');
    setIsSavingIntegrations(true);

    try {
      await upsertUserProfile({
        github_pat: toNullableTrimmed(githubPat),
      });
      await loadProfileData();
      showStatus('integrations', { message: 'Integrations saved.', tone: 'success' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save integrations.';
      showActionErrorAlert(message);
      showStatus('integrations', { message, tone: 'error' });
    } finally {
      setIsSavingIntegrations(false);
    }
  }

  async function handleSaveMercuryKey(): Promise<void> {
    clearSectionStatus('integrations');
    const apiKey = mercuryApiKey.trim();
    if (!apiKey) {
      const message = 'Mercury API key is required.';
      showValidationAlert(message);
      showStatus('integrations', { message, tone: 'error' });
      return;
    }

    setIsSavingMercuryKey(true);
    try {
      const nextStatus = await saveMercuryApiKey(apiKey);
      setMercuryCredentialStatus(nextStatus);
      setMercuryApiKey('');
      showStatus('integrations', { message: 'Mercury API key saved.', tone: 'success' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save Mercury API key.';
      showActionErrorAlert(message);
      showStatus('integrations', { message, tone: 'error' });
    } finally {
      setIsSavingMercuryKey(false);
    }
  }

  async function handleTestMercuryKey(): Promise<void> {
    clearSectionStatus('integrations');
    setIsTestingMercuryKey(true);

    try {
      await testMercuryApiKey();
      await refreshMercuryCredentialStatus();
      showStatus('integrations', { message: 'Mercury API key connected successfully.', tone: 'success' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to test Mercury API key.';
      showActionErrorAlert(message);
      showStatus('integrations', { message, tone: 'error' });
    } finally {
      setIsTestingMercuryKey(false);
    }
  }

  async function handleDeleteMercuryKey(): Promise<void> {
    clearSectionStatus('integrations');
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
      setMercuryCredentialStatus({ configured: false, keyLastFour: null, updatedAt: null });
      setMercuryApiKey('');
      showStatus('integrations', { message: 'Mercury API key deleted.', tone: 'success' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete Mercury API key.';
      showActionErrorAlert(message);
      showStatus('integrations', { message, tone: 'error' });
    } finally {
      setIsDeletingMercuryKey(false);
    }
  }

  async function handleOpenMercuryReferral(): Promise<void> {
    clearSectionStatus('integrations');
    setIsOpeningMercuryReferral(true);

    try {
      const nextStatus = await trackMercuryReferralClick();
      if (nextStatus) {
        setMercuryReferralStatus(nextStatus);
      }
      openExternalUrl(MERCURY_REFERRAL_URL);
      showStatus('integrations', {
        message: 'Mercury referral visit recorded. Premium access is granted manually after qualification is verified.',
        tone: 'success',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to record Mercury referral visit.';
      showStatus('integrations', { message, tone: 'error' });
      openExternalUrl(MERCURY_REFERRAL_URL);
    } finally {
      setIsOpeningMercuryReferral(false);
    }
  }

  function openExternalUrl(url: string, options?: { authRelated?: boolean }): void {
    if (options?.authRelated && shouldRouteAuthIntegrationsToSignIn) {
      routeAuthIntegrationsToSignIn();
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
      routeAuthIntegrationsToSignIn();
      return;
    }

    if (!isGitHubOAuthEnabled || typeof window === 'undefined') {
      return;
    }

    const oauthState = `gh_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    window.sessionStorage.setItem(GITHUB_OAUTH_STATE_KEY, oauthState);
    const redirectUri = resolveGitHubOAuthRedirectUri();
    if (!redirectUri) {
      showStatus('integrations', {
        tone: 'error',
        message: 'GitHub OAuth is unavailable: no valid redirect URL is configured.',
      });
      return;
    }

    clearSectionStatus('integrations');
    setIsSigningInWithGitHub(true);
    showStatus('integrations', {
      tone: 'neutral',
      message: 'Redirecting to GitHub so you can approve repository sync.',
    });

    const authorizeUrl = new URL(GITHUB_OAUTH_AUTHORIZE_URL);
    authorizeUrl.searchParams.set('client_id', githubClientId);
    authorizeUrl.searchParams.set('redirect_uri', redirectUri);
    authorizeUrl.searchParams.set('scope', GITHUB_OAUTH_SCOPE);
    authorizeUrl.searchParams.set('state', oauthState);

    try {
      window.location.assign(authorizeUrl.toString());
    } catch (error) {
      setIsSigningInWithGitHub(false);
      showStatus('integrations', {
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to open GitHub OAuth.',
      });
    }
  }

  async function handleExportData(): Promise<void> {
    clearSectionStatus('backup');
    setIsExportingData(true);

    try {
      const snapshot = await createBackupSnapshot();
      const downloadResult = await downloadBackup(snapshot);
      showStatus('backup', {
        message: `Backup exported (${downloadResult.filename}). ${formatBackupSummary(snapshot)}.`,
        tone: 'success',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to export backup.';
      showActionErrorAlert(message);
      showStatus('backup', { message, tone: 'error' });
    } finally {
      setIsExportingData(false);
    }
  }

  async function handleImportData(): Promise<void> {
    clearSectionStatus('backup');
    setIsImportingData(true);

    try {
      const pickedFile = await pickBackupJsonFile();
      const parsedBackup = parseAndValidateBackup(pickedFile.text);
      const confirmed = await showSystemConfirm({
        title: 'Replace local data?',
        message: [
          `File: ${pickedFile.fileName}`,
          `Created: ${new Date(parsedBackup.createdAt).toLocaleString()}`,
          `Schema version: ${parsedBackup.schemaVersion}`,
          `Contents: ${formatBackupSummary(parsedBackup)}`,
          '',
          'This will replace all local data in this browser origin.',
          `Rollback backup before import: ${createSafetyBackupBeforeImport ? 'ON' : 'OFF'}.`,
        ].join('\n'),
        confirmLabel: 'Import',
        cancelLabel: 'Cancel',
      });

      if (!confirmed) {
        showStatus('backup', { message: FILE_PICKER_CANCELED_MESSAGE, tone: 'neutral' });
        return;
      }

      const restoreReport = await restoreBackup(parsedBackup, {
        replaceAll: true,
        createSafetyBackup: createSafetyBackupBeforeImport,
      });
      await Promise.all([loadProfileData()]);

      const rollbackMessage = restoreReport.safetyBackupFilename
        ? ` Rollback backup downloaded: ${restoreReport.safetyBackupFilename}.`
        : '';
      const preferenceMessage = restoreReport.preferenceRestored
        ? ''
        : ' Timer preference restore skipped for this environment.';

      showStatus('backup', {
        message: `Import complete. Restored ${formatBackupSummary(parsedBackup)}.${rollbackMessage}${preferenceMessage}`,
        tone: 'success',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to import backup.';
      if (message === FILE_PICKER_CANCELED_MESSAGE) {
        showStatus('backup', { message, tone: 'neutral' });
      } else {
        showActionErrorAlert(message);
        showStatus('backup', { message, tone: 'error' });
      }
    } finally {
      setIsImportingData(false);
    }
  }

  async function handleSignOut(): Promise<void> {
    clearSectionStatus('general');
    setIsSigningOut(true);

    try {
      await signOutSupabase();
      showStatus('general', { message: 'Signed out.', tone: 'success' });
      router.replace('/' as never);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to sign out.';
      showActionErrorAlert(message);
      showStatus('general', { message, tone: 'error' });
    } finally {
      setIsSigningOut(false);
    }
  }

  const backupBusy =
    isLoading ||
    isSavingBusiness ||
    isSavingIntegrations ||
    isExportingData ||
    isImportingData;

  return (
    <View className="gap-3">
      <Text className="text-3xl font-extrabold text-heading">Profile</Text>
      <Text className="text-muted">
        Manage invoice sender details, integrations, and local backup tools.
      </Text>
      {sectionStatus?.section === 'general' ? (
        <InlineNotice tone={sectionStatus.tone} message={sectionStatus.message} />
      ) : null}
      <View className="items-center">
        <View className="w-full gap-3" style={contentWidthStyle}>

      <View className="gap-3 rounded-xl bg-card p-4">
        <Text className="text-xl font-bold text-heading">Your Business</Text>
        <TextInput
          value={companyName}
          onChangeText={setCompanyName}
          placeholder="Company name (optional)"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
        />
        <TextInput
          value={logoUrl}
          onChangeText={setLogoUrl}
          placeholder="Logo URL (optional)"
          autoCapitalize="none"
          autoCorrect={false}
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
        />
        <TextInput
          value={fullName}
          onChangeText={setFullName}
          placeholder="Full name"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
        />
        <TextInput
          value={businessPhone}
          onChangeText={setBusinessPhone}
          placeholder="Phone number"
          keyboardType="phone-pad"
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
        />
        <TextInput
          value={businessEmail}
          onChangeText={setBusinessEmail}
          placeholder="Email address"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          className="rounded-md border border-border bg-background px-3 py-2 text-foreground"
        />
        <Pressable
          className="rounded-md bg-secondary px-4 py-2"
          onPress={() => {
            handleSaveBusiness().catch(() => undefined);
          }}
          disabled={isSavingBusiness || isLoading}
        >
          <Text className="text-center font-semibold text-white">
            {isSavingBusiness ? 'Saving...' : 'Save Business Profile'}
          </Text>
        </Pressable>
        {sectionStatus?.section === 'business' ? (
          <InlineNotice tone={sectionStatus.tone} message={sectionStatus.message} />
        ) : null}
      </View>

      <View className="gap-3 rounded-xl bg-card p-4">
        <Pressable
          className="flex-row items-center justify-between"
          onPress={() => setShowIntegrations((current) => !current)}
        >
          <Text className="text-xl font-bold text-heading">Integrations</Text>
          <Text className="text-sm font-semibold text-secondary">
            {showIntegrations ? 'Hide' : 'Show'}
          </Text>
        </Pressable>

        {showIntegrations ? (
          <View className="gap-2">
            <Text className="text-sm text-muted">
              GitHub access is for repository and commit lookup only. It does not auto-fill your
              personal profile name or email.
            </Text>
            {isGitHubOAuthEnabled ? (
              <Pressable
                className={`self-start rounded-full border px-4 py-2 ${isSigningInWithGitHub ? 'opacity-70' : ''}`}
                style={
                  hasGitHubRepoAccess
                    ? { borderColor: '#15803d', backgroundColor: '#166534' }
                    : { borderColor: '#ffffff', backgroundColor: '#24292f' }
                }
                onPress={shouldShowManualGitHubSyncButton ? startGitHubOAuth : undefined}
                disabled={isSigningInWithGitHub || !shouldShowManualGitHubSyncButton}
              >
                <View className="flex-row items-center gap-2">
                  <Octicons name="mark-github" size={16} color="#ffffff" />
                  <Text className="font-semibold" style={{ color: '#ffffff' }}>
                    {isSigningInWithGitHub
                      ? 'Redirecting to GitHub...'
                      : 'Sync repositories from GitHub'}
                  </Text>
                  {hasGitHubRepoAccess ? (
                    <View
                      className="items-center justify-center rounded-full"
                      style={{ width: 18, height: 18, backgroundColor: '#22c55e' }}
                    >
                      <Text className="text-xs font-bold" style={{ color: '#052e16' }}>
                        ✓
                      </Text>
                    </View>
                  ) : null}
                </View>
              </Pressable>
            ) : null}
            <Pressable
              className="flex-row items-center justify-between rounded-md border border-border bg-background px-3 py-2"
              onPress={() => setShowAdvancedGitHubOptions((current) => !current)}
            >
              <Text className="font-semibold text-heading">Advanced GitHub token options</Text>
              <Text className="text-sm font-semibold text-secondary">
                {showAdvancedGitHubOptions ? 'Hide' : 'Show'}
              </Text>
            </Pressable>
            {showAdvancedGitHubOptions ? (
              <View className="gap-2 rounded-md border border-border bg-background p-3">
                <View className="flex-row items-center justify-between gap-2">
                  <Text className="flex-1 text-sm text-muted">
                    {hasGitHubSessionToken
                      ? 'Your current GitHub sign-in already unlocks repo access. Use a PAT only if you want a manually saved fallback token on this profile.'
                      : 'Optional. Save a PAT if you want a manual GitHub token on this profile or need repo access outside the current GitHub sign-in session.'}
                  </Text>
                  <Pressable
                    className="h-7 w-7 items-center justify-center rounded-full border border-border bg-card"
                    onPress={() => setShowPatInfoModal(true)}
                  >
                    <Text className="text-sm font-bold text-heading">i</Text>
                  </Pressable>
                </View>
                <Pressable
                  className="self-start rounded-full border px-4 py-2"
                  style={{ borderColor: '#d0d7de', backgroundColor: '#f6f8fa' }}
                  onPress={() => openExternalUrl(GITHUB_PAT_CREATE_URL, { authRelated: true })}
                >
                  <View className="flex-row items-center gap-2">
                    <Octicons name="mark-github" size={16} color="#24292f" />
                    <Text className="font-semibold" style={{ color: '#24292f' }}>
                      Create GitHub PAT
                    </Text>
                  </View>
                </Pressable>
                <TextInput
                  value={githubPat}
                  onChangeText={setGithubPat}
                  placeholder="GitHub access token or PAT (optional)"
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                  className="rounded-md border border-border bg-card px-3 py-2 text-foreground"
                />
                <Pressable
                  className="rounded-md bg-secondary px-4 py-2"
                  onPress={() => {
                    handleSaveIntegrations().catch(() => undefined);
                  }}
                  disabled={isSavingIntegrations || isLoading}
                >
                  <Text className="text-center font-semibold text-white">
                    {isSavingIntegrations ? 'Saving...' : 'Save Integrations'}
                  </Text>
                </Pressable>
              </View>
            ) : null}
            {shouldShowHostedMercuryCredentials ? (
              <View
                style={{
                  gap: 10,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: '#dce2ea',
                  backgroundColor: '#f6f8fb',
                  padding: 12,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Image
                    source={{ uri: '/mercury-brand-kit/mercury-brand-kit/mercury_logo_icon.png' }}
                    style={{ width: 20, height: 20 }}
                    resizeMode="contain"
                    accessibilityLabel="Mercury"
                  />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#272735' }}>
                    Mercury production API key
                  </Text>
                  {mercuryCredentialStatus?.configured ? (
                    <View
                      style={{
                        marginLeft: 'auto',
                        borderRadius: 999,
                        backgroundColor: '#d1fae5',
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#065f46' }}>
                        Connected
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text className="text-sm text-muted">
                  {mercuryCredentialStatus?.configured
                    ? `Saved key ending in ${mercuryCredentialStatus.keyLastFour ?? '....'}.`
                    : 'No Mercury production key is saved for this hosted profile.'}
                </Text>
                <TextInput
                  value={mercuryApiKey}
                  onChangeText={setMercuryApiKey}
                  placeholder="Mercury production API key"
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                  className="rounded-md border border-border bg-card px-3 py-2 text-foreground"
                />
                <View className="flex-row flex-wrap gap-2">
                  <Pressable
                    style={{
                      borderRadius: 8,
                      backgroundColor: '#272735',
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      opacity: isSavingMercuryKey || isLoading ? 0.6 : 1,
                    }}
                    onPress={() => {
                      handleSaveMercuryKey().catch(() => undefined);
                    }}
                    disabled={isSavingMercuryKey || isLoading}
                  >
                    <Text style={{ fontWeight: '600', color: '#ffffff', fontSize: 13 }}>
                      {isSavingMercuryKey ? 'Saving...' : 'Save Mercury Key'}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={{
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: '#dce2ea',
                      backgroundColor: '#ffffff',
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      opacity: isTestingMercuryKey || !mercuryCredentialStatus?.configured ? 0.5 : 1,
                    }}
                    onPress={() => {
                      handleTestMercuryKey().catch(() => undefined);
                    }}
                    disabled={isTestingMercuryKey || !mercuryCredentialStatus?.configured}
                  >
                    <Text style={{ fontWeight: '600', color: '#272735', fontSize: 13 }}>
                      {isTestingMercuryKey ? 'Testing...' : 'Test Key'}
                    </Text>
                  </Pressable>
                  {mercuryCredentialStatus?.configured ? (
                    <Pressable
                      className="rounded-md border border-danger px-4 py-2"
                      onPress={() => {
                        handleDeleteMercuryKey().catch(() => undefined);
                      }}
                      disabled={isDeletingMercuryKey}
                    >
                      <Text className="text-center font-semibold text-danger">
                        {isDeletingMercuryKey ? 'Deleting...' : 'Delete Key'}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ) : null}
            {shouldShowHostedMercuryCredentials ? (
              <View
                style={{
                  gap: 10,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: '#dce2ea',
                  backgroundColor: '#f6f8fb',
                  padding: 12,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Image
                    source={{ uri: '/mercury-brand-kit/mercury-brand-kit/mercury_logo_icon.png' }}
                    style={{ width: 20, height: 20 }}
                    resizeMode="contain"
                    accessibilityLabel="Mercury"
                  />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#272735' }}>
                    Mercury referral premium
                  </Text>
                  {mercuryReferralStatus?.premiumAccess ? (
                    <View
                      style={{
                        marginLeft: 'auto',
                        borderRadius: 999,
                        backgroundColor: '#d1fae5',
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#065f46' }}>
                        Premium
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text className="text-sm text-muted">
                  {mercuryReferralStatus?.premiumAccess
                    ? `Premium access granted${mercuryReferralStatus.premiumAccessGrantedAt ? ` on ${new Date(mercuryReferralStatus.premiumAccessGrantedAt).toLocaleDateString()}` : ''}.`
                    : mercuryReferralStatus && mercuryReferralStatus.status !== 'none'
                      ? `Referral status: ${mercuryReferralStatus.status.replace('_', ' ')}.`
                      : 'No Mercury referral visit recorded for this profile yet.'}
                </Text>
                <Pressable
                  style={{
                    alignSelf: 'flex-start',
                    borderRadius: 8,
                    backgroundColor: '#272735',
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    opacity: isOpeningMercuryReferral ? 0.6 : 1,
                  }}
                  onPress={() => {
                    handleOpenMercuryReferral().catch(() => undefined);
                  }}
                  disabled={isOpeningMercuryReferral}
                >
                  <Text style={{ fontWeight: '600', color: '#ffffff', fontSize: 13 }}>
                    {isOpeningMercuryReferral ? 'Opening...' : 'Open Mercury Referral'}
                  </Text>
                </Pressable>
              </View>
            ) : null}
            {isHostedMode() && tourModeEnabled ? (
              <InlineNotice
                tone="neutral"
                message="Tour mode uses Mercury sandbox credentials. Sign in to save your own production Mercury API key."
              />
            ) : null}
            {sectionStatus?.section === 'integrations' ? (
              <InlineNotice tone={sectionStatus.tone} message={sectionStatus.message} />
            ) : null}
          </View>
        ) : null}
      </View>

      <View className="gap-3 rounded-xl bg-card p-4">
        <Text className="text-xl font-bold text-heading">Data Backup</Text>
        <Text className="text-sm text-muted">
          Export your local data to JSON and import it later. In hosted mode, import restores this
          snapshot into your signed-in account.
        </Text>

        <View className="flex-row items-center justify-between rounded-md border border-border bg-background px-3 py-2">
          <Text className="flex-1 pr-2 text-sm text-foreground">
            Create rollback backup before import
          </Text>
          <Pressable
            className={createSafetyBackupBeforeImport ? 'rounded-full bg-secondary px-3 py-1.5' : 'rounded-full bg-primary px-3 py-1.5'}
            onPress={() => setCreateSafetyBackupBeforeImport((current) => !current)}
            disabled={backupBusy}
          >
            <Text className={createSafetyBackupBeforeImport ? 'font-semibold text-white' : 'font-semibold text-heading'}>
              {createSafetyBackupBeforeImport ? 'ON' : 'OFF'}
            </Text>
          </Pressable>
        </View>

        <View className="flex-row flex-wrap gap-2">
          <Pressable
            className="rounded-md bg-secondary px-4 py-2"
            onPress={() => {
              handleExportData().catch(() => undefined);
            }}
            disabled={backupBusy}
          >
            <Text className="text-center font-semibold text-white">
              {isExportingData ? 'Exporting...' : 'Export Data'}
            </Text>
          </Pressable>

          <Pressable
            className="rounded-md border border-border px-4 py-2"
            onPress={() => {
              handleImportData().catch(() => undefined);
            }}
            disabled={backupBusy}
          >
            <Text className="text-center font-semibold text-heading">
              {isImportingData ? 'Importing...' : 'Import Data'}
            </Text>
          </Pressable>
        </View>
        {sectionStatus?.section === 'backup' ? (
          <InlineNotice tone={sectionStatus.tone} message={sectionStatus.message} />
        ) : null}
      </View>

      {isHostedMode() && isAuthenticated ? (
        <View className="items-end pt-2">
          <Pressable
            className={`rounded-md border border-danger px-4 py-2 ${isSigningOut ? 'opacity-70' : ''}`}
            onPress={() => {
              handleSignOut().catch(() => undefined);
            }}
            disabled={isSigningOut}
          >
            <Text className="text-center font-semibold text-danger">
              {isSigningOut ? 'Signing out...' : 'Sign Out'}
            </Text>
          </Pressable>
        </View>
      ) : null}
        </View>
      </View>

      <Modal
        visible={showPatInfoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPatInfoModal(false)}
      >
        <View className="flex-1 items-center justify-center bg-black/55 px-4">
          <View className="w-full max-w-lg rounded-xl bg-card p-4">
            <Text className="text-lg font-bold text-heading">GitHub PAT Help</Text>
            <ScrollView
              className="mt-3 max-h-[420px]"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 8 }}
            >
              <Text className="text-sm leading-6 text-muted">
                A Personal Access Token (PAT) is a secret key from your GitHub account. This app
                uses it only to authenticate GitHub API calls so commit/branch lookups are more
                reliable and less likely to hit public rate limits.
              </Text>
              <Text className="mt-3 text-sm font-semibold text-heading">What it does here</Text>
              <Text className="mt-1 text-sm leading-6 text-muted">
                Increases GitHub API rate limit from 60 to 5,000 requests/hour and improves
                commit/branch fetch success.
              </Text>
              <Text className="mt-3 text-sm font-semibold text-heading">Where to create it</Text>
              <Text className="mt-1 text-sm leading-6 text-muted">
                GitHub Settings / Developer settings / Personal access tokens. Use the button
                below to open the creation page.
              </Text>
              <Text className="mt-3 text-sm font-semibold text-heading">Recommended scope</Text>
              <Text className="mt-1 text-sm leading-6 text-muted">
                For private-repo commit lookups, set repository Contents to Read-only (Metadata
                Read-only stays enabled by default). Do not grant more permissions than needed.
              </Text>
            </ScrollView>
            <View className="mt-3 gap-2">
              <Pressable
                className="rounded-md bg-secondary px-3 py-2"
                onPress={() => openExternalUrl(GITHUB_PAT_CREATE_URL, { authRelated: true })}
              >
                <Text className="text-center font-semibold text-white">Open PAT Creation Page</Text>
              </Pressable>
              <Pressable
                className="rounded-md border border-border px-3 py-2"
                onPress={() => openExternalUrl(GITHUB_PAT_DOCS_URL, { authRelated: true })}
              >
                <Text className="text-center font-semibold text-heading">Open PAT Docs</Text>
              </Pressable>
              <Pressable
                className="rounded-md border border-border px-3 py-2"
                onPress={() => setShowPatInfoModal(false)}
              >
                <Text className="text-center font-semibold text-heading">Close</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
