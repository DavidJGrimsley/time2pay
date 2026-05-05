import { getSupabaseClient } from '@/services/supabase-client';

export type MercuryCredentialStatus = {
  configured: boolean;
  keyLastFour: string | null;
  updatedAt: string | null;
  arAccessAvailable: boolean | null;
  arAccessVerifiedAt: string | null;
};

type MercuryCredentialAction =
  | { action: 'status' }
  | { action: 'save'; payload: { apiKey: string } }
  | { action: 'delete' }
  | { action: 'test' }
  | { action: 'setArAccess'; payload: { enabled: boolean } };

async function getHostedBearerToken(): Promise<string> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error('Sign in to manage Mercury credentials.');
  }

  const token = data.session?.access_token?.trim();
  if (!token) {
    throw new Error('Sign in to manage Mercury credentials.');
  }

  return token;
}

async function credentialAction<T>(request: MercuryCredentialAction): Promise<T> {
  const token = await getHostedBearerToken();
  const response = await fetch('/api/mercury-credentials', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(request),
  });

  const text = await response.text();
  let payload: { error?: string } | T;
  try {
    payload = text ? (JSON.parse(text) as { error?: string } | T) : ({} as T);
  } catch {
    payload = {} as T;
  }

  if (!response.ok) {
    const errorMessage =
      typeof (payload as { error?: string }).error === 'string'
        ? (payload as { error: string }).error
        : text.trim();
    throw new Error(errorMessage || `Mercury credential request failed (${response.status}).`);
  }

  return payload as T;
}

export function getMercuryCredentialStatus(): Promise<MercuryCredentialStatus> {
  return credentialAction<MercuryCredentialStatus>({ action: 'status' });
}

export function saveMercuryApiKey(apiKey: string): Promise<MercuryCredentialStatus> {
  return credentialAction<MercuryCredentialStatus>({
    action: 'save',
    payload: { apiKey },
  });
}

export function deleteMercuryApiKey(): Promise<void> {
  return credentialAction<void>({ action: 'delete' });
}

export function testMercuryApiKey(): Promise<void> {
  return credentialAction<void>({ action: 'test' });
}

export function setMercuryArAccess(enabled: boolean): Promise<MercuryCredentialStatus> {
  return credentialAction<MercuryCredentialStatus>({
    action: 'setArAccess',
    payload: { enabled },
  });
}
