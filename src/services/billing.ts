import type {
  BillingSubscriptionAction,
  BillingSubscriptionSummary,
  HostedAccessResult,
  HostedOffer,
} from '@/database/hosted/billing/types';
import { getAppAccessMode } from '@/services/runtime-mode';
import { getSupabaseClient } from '@/services/supabase-client';

export type BillingCheckoutTheme = 'light' | 'dark';

export class BillingApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null,
  ) {
    super(message);
    this.name = 'BillingApiError';
  }
}

type BillingErrorPayload = {
  error?: string;
  code?: string;
};

async function getHostedBillingBearerToken(): Promise<string> {
  if (getAppAccessMode() !== 'hosted') {
    throw new BillingApiError('Hosted billing is only available for signed-in hosted accounts.', 400, null);
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token?.trim()) {
    throw new BillingApiError('Sign in to manage hosted billing.', 401, 'unauthorized');
  }

  return data.session.access_token.trim();
}

async function billingRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getHostedBillingBearerToken();
  let response: Response;
  try {
    response = await fetch(path, {
      ...options,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });
  } catch {
    throw new BillingApiError('Unable to reach hosted billing. Check your connection and try again.', 0, 'network');
  }

  const text = await response.text();
  let payload: T | BillingErrorPayload = {};
  try {
    payload = text ? (JSON.parse(text) as T | BillingErrorPayload) : {};
  } catch {
    payload = {};
  }

  if (!response.ok) {
    const errorPayload = payload as BillingErrorPayload;
    throw new BillingApiError(
      errorPayload.error || text.trim() || `Billing request failed (${response.status}).`,
      response.status,
      errorPayload.code ?? null,
    );
  }

  return payload as T;
}

export function getHostedBillingStatus(signal?: AbortSignal): Promise<HostedAccessResult> {
  return billingRequest<HostedAccessResult>('/api/billing/status', { method: 'GET', signal });
}

export function createHostedCheckout(
  offer: HostedOffer,
  theme: BillingCheckoutTheme = 'light',
): Promise<{ clientSecret: string }> {
  return billingRequest<{ clientSecret: string }>('/api/billing/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ offer, theme }),
  });
}

export function getBillingSubscription(
  signal?: AbortSignal,
): Promise<BillingSubscriptionSummary | null> {
  return billingRequest<BillingSubscriptionSummary | null>('/api/billing/subscription', {
    method: 'GET',
    signal,
  });
}

export function updateBillingSubscription(
  action: BillingSubscriptionAction,
): Promise<BillingSubscriptionSummary> {
  return billingRequest<BillingSubscriptionSummary>('/api/billing/subscription', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  });
}

export function createBillingPaymentMethodSetup(): Promise<{ clientSecret: string }> {
  return billingRequest<{ clientSecret: string }>('/api/billing/payment-method', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'create_setup' }),
  });
}

export function updateBillingPaymentMethod(paymentMethodId: string): Promise<BillingSubscriptionSummary> {
  return billingRequest<BillingSubscriptionSummary>('/api/billing/payment-method', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'set_default', paymentMethodId }),
  });
}

export function syncHostedBilling(
  checkoutSessionId?: string,
  signal?: AbortSignal,
): Promise<HostedAccessResult> {
  return billingRequest<HostedAccessResult>('/api/billing/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify(checkoutSessionId ? { checkoutSessionId } : {}),
  });
}
