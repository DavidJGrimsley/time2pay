import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { getProfileCompletion } from '@/services/profile-completion';
import { initializeDatabase, upsertUserProfile } from '@/database/db';
import { isHostedMode } from '@/services/runtime-mode';
import { showActionErrorAlert } from '@/services/system-alert';
import { signOutSupabase } from '@/services/supabase-client';
import { useAuthUiStore } from '@/stores/auth-ui-store';
import type { NoticeTone } from '@/components/inline-notice';
import {
  GITHUB_OAUTH_PROXY_PATH,
  GITHUB_OAUTH_STATE_KEY,
  isGitHubOAuthEnabled,
  resolveGitHubOAuthRedirectUri,
} from './integrations/github-oauth-shared';

type GeneralStatus = { message: string; tone: NoticeTone } | null;

export function useSettingsScreen() {
  const router = useRouter();
  const tourModeEnabled = useAuthUiStore((state) => state.tourModeEnabled);
  const isAuthenticated = useAuthUiStore((state) => state.isAuthenticated);
  const shouldRouteAuthIntegrationsToSignIn = isHostedMode() && tourModeEnabled;

  const [isProfileIncomplete, setIsProfileIncomplete] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [generalStatus, setGeneralStatus] = useState<GeneralStatus>(null);
  const [dataVersion, setDataVersion] = useState(0);

  const refreshProfileCompletion = useCallback((): void => {
    initializeDatabase()
      .then(() => getProfileCompletion())
      .then((completion) => setIsProfileIncomplete(!completion.isComplete))
      .catch(() => setIsProfileIncomplete(false));
  }, []);

  useEffect(() => {
    refreshProfileCompletion();
  }, [refreshProfileCompletion, dataVersion]);

  const bumpDataVersion = useCallback((): void => {
    setDataVersion((current) => current + 1);
  }, []);

  // GitHub OAuth always redirects back to /settings (see github-oauth-shared.ts). Complete the
  // token exchange here, then send the user into Integrations so they can see the connected state.
  useEffect(() => {
    if (!isGitHubOAuthEnabled() || typeof window === 'undefined') {
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
      router.push('/sign-in' as never);
      return;
    }

    if (oauthError) {
      const errorDescription = url.searchParams.get('error_description')?.trim();
      setGeneralStatus({
        tone: 'error',
        message: errorDescription ? `GitHub OAuth failed: ${errorDescription}` : 'GitHub OAuth failed.',
      });
      clearOAuthQueryParams();
      return;
    }

    const returnedState = url.searchParams.get('state')?.trim() ?? '';
    const expectedState = window.sessionStorage.getItem(GITHUB_OAUTH_STATE_KEY) ?? '';
    if (!returnedState || !expectedState || returnedState !== expectedState) {
      setGeneralStatus({ tone: 'error', message: 'GitHub OAuth failed: state verification did not match.' });
      clearOAuthQueryParams();
      return;
    }

    window.sessionStorage.removeItem(GITHUB_OAUTH_STATE_KEY);
    const redirectUri = resolveGitHubOAuthRedirectUri();
    if (!redirectUri) {
      setGeneralStatus({ tone: 'error', message: 'GitHub OAuth failed: no valid redirect URL is available.' });
      clearOAuthQueryParams();
      return;
    }

    let cancelled = false;
    setGeneralStatus({ tone: 'neutral', message: 'Completing GitHub sign-in...' });

    fetch(GITHUB_OAUTH_PROXY_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: oauthCode, redirectUri }),
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

        const githubUserResponse = await fetch('https://api.github.com/user', {
          method: 'GET',
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `${payload.token_type ?? 'Bearer'} ${token}`,
          },
        });
        const githubUser = (await githubUserResponse.json()) as { login?: string; name?: string };

        if (cancelled) {
          return;
        }

        const display = githubUser.name?.trim() || githubUser.login?.trim() || 'GitHub account';
        setGeneralStatus({ tone: 'success', message: `GitHub connected for ${display}. Opening Integrations…` });
        router.replace('/settings/integrations' as never);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setGeneralStatus({
            tone: 'error',
            message: error instanceof Error ? error.message : 'GitHub OAuth failed.',
          });
        }
      })
      .finally(() => {
        if (!cancelled) {
          clearOAuthQueryParams();
        }
      });

    return () => {
      cancelled = true;
    };
  }, [router, shouldRouteAuthIntegrationsToSignIn]);

  async function handleSignOut(): Promise<void> {
    setGeneralStatus(null);
    setIsSigningOut(true);

    try {
      await signOutSupabase();
      setGeneralStatus({ message: 'Signed out.', tone: 'success' });
      router.replace('/' as never);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to sign out.';
      showActionErrorAlert(message);
      setGeneralStatus({ message, tone: 'error' });
    } finally {
      setIsSigningOut(false);
    }
  }

  return {
    isProfileIncomplete,
    refreshProfileCompletion,
    bumpDataVersion,
    dataVersion,
    generalStatus,
    isSigningOut,
    showSignOut: isHostedMode() && isAuthenticated,
    handleSignOut: () => {
      handleSignOut().catch(() => undefined);
    },
  };
}
