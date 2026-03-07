export type MercuryConfig = {
  apiKey: string;
  baseUrl: string;
};

export type MercuryInvoicePayload = {
  customerName: string;
  customerEmail?: string;
  amount: number;
  currency?: string;
  description?: string;
  dueDateIso?: string;
};

export type MercuryInvoiceResponse = {
  id: string;
  status?: string;
  hosted_url?: string;
  [key: string]: unknown;
};

function getMercuryConfig(): MercuryConfig {
  const apiKey = process.env.EXPO_PUBLIC_MERCURY_API_KEY;
  const baseUrl = process.env.EXPO_PUBLIC_MERCURY_BASE_URL ?? 'https://api.mercury.com/api/v1';

  if (!apiKey) {
    throw new Error('Missing EXPO_PUBLIC_MERCURY_API_KEY environment variable.');
  }

  return {
    apiKey,
    baseUrl,
  };
}

async function mercuryRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const config = getMercuryConfig();
  const response = await fetch(`${config.baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Mercury API request failed (${response.status}): ${body}`);
  }

  return (await response.json()) as T;
}

export async function testMercuryConnection(): Promise<{ ok: true; environment: string }> {
  const result = await mercuryRequest<{ accounts?: unknown[] }>('/accounts');
  return {
    ok: true,
    environment: Array.isArray(result.accounts) ? 'connected' : 'unknown',
  };
}

export async function listMercuryAccounts(): Promise<unknown[]> {
  const result = await mercuryRequest<{ accounts?: unknown[] }>('/accounts');
  return result.accounts ?? [];
}

export async function createMercuryInvoice(
  payload: MercuryInvoicePayload,
): Promise<MercuryInvoiceResponse> {
  const body = {
    customer_name: payload.customerName,
    customer_email: payload.customerEmail,
    amount: payload.amount,
    currency: payload.currency ?? 'USD',
    description: payload.description,
    due_date: payload.dueDateIso,
  };

  return mercuryRequest<MercuryInvoiceResponse>('/invoices', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
