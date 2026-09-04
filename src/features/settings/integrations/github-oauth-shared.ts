import { Platform } from 'react-native';
import { readTrimmedPublicRuntimeConfigValue } from '@/services/runtime-config';
import { isHostedMode } from '@/services/runtime-mode';
import { requireConfiguredSiteOrigin, resolveBrowserSiteOrigin } from '@/services/site-origin';

/**
 * GitHub OAuth always redirects back to the settings hub (`/settings`), not the
 * `/settings/integrations` sub-route, because that's the URL registered with the
 * GitHub OAuth App. The hub completes the token exchange, then routes the user
 * into Integrations once it's done. Keep this in one shared module so the
 * redirect_uri computed when *starting* OAuth (integrations screen) always
 * matches the one used when *completing* it (settings hub).
 */
export const GITHUB_OAUTH_REDIRECT_PATH = '/settings';
export const GITHUB_OAUTH_PROXY_PATH = '/api/github';
export const GITHUB_OAUTH_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
export const GITHUB_OAUTH_SCOPE = 'repo read:user';
export const GITHUB_OAUTH_STATE_KEY = 'time2pay_github_oauth_state';
export const GITHUB_PAT_CREATE_URL = 'https://github.com/settings/personal-access-tokens/new';
export const GITHUB_PAT_DOCS_URL =
  'https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens';

export function getGitHubOAuthClientId(): string | undefined {
  return readTrimmedPublicRuntimeConfigValue('EXPO_PUBLIC_GITHUB_CLIENT_ID');
}

export function isGitHubOAuthEnabled(): boolean {
  return Platform.OS === 'web' && Boolean(getGitHubOAuthClientId());
}

export function resolveGitHubOAuthRedirectUri(): string | null {
  if (isHostedMode()) {
    try {
      requireConfiguredSiteOrigin();
      return new URL(GITHUB_OAUTH_REDIRECT_PATH, resolveBrowserSiteOrigin()).toString();
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

  return new URL(GITHUB_OAUTH_REDIRECT_PATH, window.location.origin).toString();
}
