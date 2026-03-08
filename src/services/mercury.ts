export type MercuryConfig = {
  proxyPath: string;
};

export type MercuryLineItemPayload = {
  name: string;
  quantity: number;
  unitPrice: number;
  salesTaxRate?: number;
};

export type MercurySendEmailOption = 'DontSend' | 'SendNow';

export type MercuryInvoicePayload = {
  customerName: string;
  customerEmail?: string;
  amount: number;
  currency?: string;
  description?: string;
  dueDateIso?: string;
  invoiceDateIso?: string;
  destinationAccountId?: string;
  lineItems?: MercuryLineItemPayload[];
  sendEmailOption?: MercurySendEmailOption;
  achDebitEnabled?: boolean;
  creditCardEnabled?: boolean;
  useRealAccountNumber?: boolean;
  ccEmails?: string[];
};

export type MercuryInvoiceResponse = {
  id: string;
  status?: string;
  slug?: string;
  hosted_url?: string;
  [key: string]: unknown;
};

type MercuryAccount = {
  id?: string;
  status?: string;
  type?: string;
  kind?: string;
  name?: string;
  nickname?: string | null;
  [key: string]: unknown;
};

type MercuryCustomer = {
  id: string;
  name: string;
  email: string;
  deletedAt?: string | null;
  [key: string]: unknown;
};

type MercuryAccountsResponse = {
  accounts?: MercuryAccount[];
};

type MercuryCustomersResponse = {
  customers?: MercuryCustomer[];
  page?: {
    nextPage?: string | null;
    previousPage?: string | null;
  };
};

function getMercuryConfig(): MercuryConfig {
  return {
    proxyPath: process.env.EXPO_PUBLIC_MERCURY_PROXY_PATH ?? '/api/mercury',
  };
}

async function mercuryRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const config = getMercuryConfig();

  let body: unknown;
  if (typeof init?.body === 'string') {
    body = JSON.parse(init.body);
  } else if (init?.body != null) {
    throw new Error('Unsupported Mercury request body type. Expected a JSON string body.');
  }

  const method = init?.method ?? 'GET';

  const response = await fetch(config.proxyPath, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      path,
      method,
      body,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Mercury API request failed (${response.status}): ${body}`);
  }

  return (await response.json()) as T;
}

function assertNonNegativeFinite(value: number, fieldName: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid ${fieldName}: expected a non-negative finite number.`);
  }
  return value;
}

function toDayString(inputIso: string): string {
  const parsed = new Date(inputIso);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date value: ${inputIso}`);
  }
  return parsed.toISOString().slice(0, 10);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function scoreAccount(account: MercuryAccount): number {
  const status = `${account.status ?? ''}`.toLowerCase();
  const type = `${account.type ?? ''}`.toLowerCase();
  const kind = `${account.kind ?? ''}`.toLowerCase();
  const name = `${account.nickname ?? account.name ?? ''}`.toLowerCase();

  let score = 0;
  if (status === 'active') {
    score += 4;
  }
  if (type.includes('mercury')) {
    score += 2;
  }
  if (type.includes('checking') || kind.includes('checking') || name.includes('checking')) {
    score += 6;
  }

  return score;
}

function pickDestinationAccountId(accounts: MercuryAccount[]): string | null {
  const withId = accounts.filter((account): account is MercuryAccount & { id: string } =>
    typeof account.id === 'string' && account.id.trim().length > 0,
  );

  if (withId.length === 0) {
    return null;
  }

  const sorted = [...withId].sort((a, b) => scoreAccount(b) - scoreAccount(a));
  return sorted[0]?.id ?? null;
}

async function resolveDestinationAccountId(explicitAccountId?: string): Promise<string> {
  if (explicitAccountId?.trim()) {
    return explicitAccountId.trim();
  }

  const result = await mercuryRequest<MercuryAccountsResponse>('/accounts');
  const accountId = pickDestinationAccountId(result.accounts ?? []);

  if (!accountId) {
    throw new Error('No Mercury destination account found. Connect an account and try again.');
  }

  return accountId;
}

async function findExistingCustomerId(customerName: string, customerEmail: string): Promise<string | null> {
  let cursor: string | null = null;
  const desiredEmail = normalizeEmail(customerEmail);
  const desiredName = normalizeName(customerName);

  // Prevent infinite loops if cursor pagination repeats unexpectedly.
  for (let page = 0; page < 20; page += 1) {
    const params = new URLSearchParams({
      limit: '200',
      order: 'asc',
    });
    if (cursor) {
      params.set('start_after', cursor);
    }

    const path = `/ar/customers?${params.toString()}`;
    const response = await mercuryRequest<MercuryCustomersResponse>(path);
    const customers = response.customers ?? [];

    const match = customers.find((customer) => {
      const candidateEmail = normalizeEmail(customer.email ?? '');
      const candidateName = normalizeName(customer.name ?? '');
      const deleted = !!customer.deletedAt;
      return !deleted && (candidateEmail === desiredEmail || candidateName === desiredName);
    });

    if (match?.id) {
      return match.id;
    }

    const nextPage = response.page?.nextPage ?? null;
    if (!nextPage || nextPage === cursor || customers.length === 0) {
      return null;
    }

    cursor = nextPage;
  }

  return null;
}

async function ensureMercuryCustomerId(customerName: string, customerEmail: string): Promise<string> {
  const existingId = await findExistingCustomerId(customerName, customerEmail);
  if (existingId) {
    return existingId;
  }

  const created = await mercuryRequest<MercuryCustomer>('/ar/customers', {
    method: 'POST',
    body: JSON.stringify({
      name: customerName.trim(),
      email: customerEmail.trim(),
    }),
  });

  if (!created?.id) {
    throw new Error('Mercury customer creation succeeded but no customer ID was returned.');
  }

  return created.id;
}

function buildMercuryLineItems(payload: MercuryInvoicePayload): MercuryLineItemPayload[] {
  const explicit = payload.lineItems ?? [];
  if (explicit.length > 0) {
    return explicit.map((lineItem) => ({
      name: lineItem.name.trim() || 'Service',
      quantity: assertNonNegativeFinite(lineItem.quantity, 'line item quantity'),
      unitPrice: assertNonNegativeFinite(lineItem.unitPrice, 'line item unitPrice'),
      salesTaxRate:
        lineItem.salesTaxRate == null
          ? undefined
          : assertNonNegativeFinite(lineItem.salesTaxRate, 'line item salesTaxRate'),
    }));
  }

  return [
    {
      name: payload.description?.trim() || 'Service',
      quantity: 1,
      unitPrice: assertNonNegativeFinite(payload.amount, 'amount'),
    },
  ];
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
  const customerName = payload.customerName.trim();
  if (!customerName) {
    throw new Error('Customer name is required for Mercury invoice creation.');
  }

  const customerEmail = payload.customerEmail?.trim();
  if (!customerEmail) {
    throw new Error('Customer email is required to create and send a Mercury invoice.');
  }

  const destinationAccountId = await resolveDestinationAccountId(payload.destinationAccountId);
  const customerId = await ensureMercuryCustomerId(customerName, customerEmail);
  const invoiceDate = toDayString(payload.invoiceDateIso ?? new Date().toISOString());
  const dueDate = toDayString(
    payload.dueDateIso ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  );
  const lineItems = buildMercuryLineItems(payload);

  const body = {
    dueDate,
    invoiceDate,
    customerId,
    ccEmails: payload.ccEmails ?? [],
    destinationAccountId,
    creditCardEnabled: payload.creditCardEnabled ?? false,
    achDebitEnabled: payload.achDebitEnabled ?? true,
    useRealAccountNumber: payload.useRealAccountNumber ?? false,
    lineItems,
    sendEmailOption: payload.sendEmailOption ?? 'SendNow',
    internalNote: payload.description,
    payerMemo: payload.description,
  };

  return mercuryRequest<MercuryInvoiceResponse>('/ar/invoices', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
