import {
  readLocalStorageItem,
  removeLocalStorageItem,
  writeLocalStorageItem,
} from '@/services/browser-storage';
import type {
  MercuryReferralStatus,
  MercuryReferralStatusValue,
} from '@/database/hosted/mercury/types';
import { getAppAccessMode } from '@/services/runtime-mode';
import { getSupabaseClient } from '@/services/supabase-client';

export const MERCURY_REFERRAL_URL = 'https://mercury.com/partner/time2pay';

const PENDING_REFERRAL_CLICK_KEY = 'time2pay.mercury.referral.pending-clicked-at';

export type { MercuryReferralStatus, MercuryReferralStatusValue };

type MercuryReferralAction =
  | { action: 'status' }
  | { action: 'trackClick' };

async function getHostedBearerToken(): Promise<string | null> {
  if (getAppAccessMode() !== 'hosted') {
    return null;
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error('Sign in to track Mercury referral status.');
  }

  return data.session?.access_token?.trim() || null;
}

async function referralAction<T>(request: MercuryReferralAction): Promise<T> {
  const token = await getHostedBearerToken();
  if (!token) {
    throw new Error('Sign in to track Mercury referral status.');
  }

  const response = await fetch('/api/mercury-referrals', {
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
    throw new Error(errorMessage || `Mercury referral request failed (${response.status}).`);
  }

  return payload as T;
}

export function rememberPendingMercuryReferralClick(): void {
  writeLocalStorageItem(PENDING_REFERRAL_CLICK_KEY, new Date().toISOString());
}

export async function trackMercuryReferralClick(): Promise<MercuryReferralStatus | null> {
  if (getAppAccessMode() !== 'hosted') {
    rememberPendingMercuryReferralClick();
    return null;
  }

  try {
    return await referralAction<MercuryReferralStatus>({ action: 'trackClick' });
  } catch {
    rememberPendingMercuryReferralClick();
    return null;
  }
}

export function getMercuryReferralStatus(): Promise<MercuryReferralStatus> {
  return referralAction<MercuryReferralStatus>({ action: 'status' });
}

export async function syncPendingMercuryReferralClick(): Promise<void> {
  const pendingClickedAt = readLocalStorageItem(PENDING_REFERRAL_CLICK_KEY);
  if (!pendingClickedAt) {
    return;
  }

  await referralAction<MercuryReferralStatus>({ action: 'trackClick' });
  removeLocalStorageItem(PENDING_REFERRAL_CLICK_KEY);
}
