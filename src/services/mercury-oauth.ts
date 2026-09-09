import { getSupabaseClient } from '@/services/supabase-client';

export type MercuryOAuthEnvironment = 'production' | 'sandbox';
export type MercuryOAuthConnectionState =
  | 'unavailable'
  | 'disconnected'
  | 'connected'
  | 'reauthorization_required';

export type MercuryOAuthConnectionStatus = {
  available: boolean;
  connectionState: MercuryOAuthConnectionState;
  environment: MercuryOAuthEnvironment | null;
  scopes: string[];
  connectedAt: string | null;
  lastRefreshedAt: string | null;
  accessTokenExpiresAt: string | null;
};

type MercuryOAuthAction =
  | { action: 'status' }
  | { action: 'start' }
  | { action: 'disconnect' };

async function getHostedBearerToken(): Promise<string> {
  const { data, error } = await getSupabaseClient().auth.getSession();
  const token = data.session?.access_token?.trim();
  if (error || !token) {
    throw new Error('Sign in to connect Mercury.');
  }
  return token;
}

async function oauthAction<T>(request: MercuryOAuthAction): Promise<T> {
  const token = await getHostedBearerToken();
  const response = await fetch('/api/mercury-oauth', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });
  const text = await response.text();
  let payload: T | { error?: string } = {} as T;
  try {
    payload = text ? (JSON.parse(text) as T | { error?: string }) : ({} as T);
  } catch {
    // The status still determines whether the response is usable.
  }
  if (!response.ok) {
    const error = (payload as { error?: string }).error;
    throw new Error(error || `Mercury OAuth request failed (${response.status}).`);
  }
  return payload as T;
}

export function getMercuryOAuthStatus(): Promise<MercuryOAuthConnectionStatus> {
  return oauthAction({ action: 'status' });
}

export function startMercuryOAuth(): Promise<{ authorizationUrl: string }> {
  return oauthAction({ action: 'start' });
}

export function disconnectMercuryOAuth(): Promise<MercuryOAuthConnectionStatus> {
  return oauthAction({ action: 'disconnect' });
}
