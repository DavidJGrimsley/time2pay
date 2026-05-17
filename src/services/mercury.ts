import type {
  MercuryAccount,
  MercuryInvoicePayload,
  MercuryInvoiceResponse,
  MercuryRecipient,
  MercuryRecord,
  MercurySendMoneyInput,
  MercuryTransaction,
} from '@mr.dj2u/mercury';
import { getAppAccessMode, type AppAccessMode } from '@/services/runtime-mode';
import { getSupabaseClient } from '@/services/supabase-client';

export type MercuryConfig = {
  proxyPath: string;
};

type MercuryActionName =
  | 'testConnection'
  | 'testInvoiceAccess'
  | 'ensureCustomer'
  | 'listAccounts'
  | 'createInvoice'
  | 'listRecipients'
  | 'createRecipient'
  | 'updateRecipient'
  | 'sendMoney';

type MercuryActionPayloadMap = {
  testConnection: undefined;
  testInvoiceAccess: undefined;
  ensureCustomer: { name: string; email: string };
  listAccounts: undefined;
  createInvoice: MercuryInvoicePayload;
  listRecipients: undefined;
  createRecipient: MercuryRecord;
  updateRecipient: { recipientId: string; input: MercuryRecord };
  sendMoney: { accountId: string; input: MercurySendMoneyInput };
};

type MercuryActionResponseMap = {
  testConnection: { ok: true; environment: string };
  testInvoiceAccess: { ok: true; environment: string };
  ensureCustomer: { customerId: string };
  listAccounts: { accounts: MercuryAccount[] };
  createInvoice: { invoice: MercuryInvoiceResponse };
  listRecipients: { recipients: MercuryRecipient[] };
  createRecipient: { recipient: MercuryRecipient };
  updateRecipient: { recipient: MercuryRecipient };
  sendMoney: { transaction: MercuryTransaction };
};

type MercuryResourceCache<T> = {
  scope: AppAccessMode | null;
  data: T | null;
  updatedAt: number;
  inFlight: Promise<T> | null;
};

export type MercuryResourceCacheName = 'accounts' | 'recipients';

const MERCURY_RESOURCE_CACHE_TTL_MS = 60_000;
const mercuryAccountsCache: MercuryResourceCache<MercuryAccount[]> = createMercuryResourceCache();
const mercuryRecipientsCache: MercuryResourceCache<MercuryRecipient[]> = createMercuryResourceCache();

function createMercuryResourceCache<T>(): MercuryResourceCache<T> {
  return {
    scope: null,
    data: null,
    updatedAt: 0,
    inFlight: null,
  };
}

function resetMercuryResourceCache<T>(cache: MercuryResourceCache<T>): void {
  cache.scope = null;
  cache.data = null;
  cache.updatedAt = 0;
  cache.inFlight = null;
}

function prepareMercuryResourceCache<T>(
  cache: MercuryResourceCache<T>,
  scope: AppAccessMode,
): void {
  if (cache.scope === scope) {
    return;
  }

  cache.scope = scope;
  cache.data = null;
  cache.updatedAt = 0;
  cache.inFlight = null;
}

function startMercuryResourceFetch<T>(
  cache: MercuryResourceCache<T>,
  scope: AppAccessMode,
  fetcher: () => Promise<T>,
): Promise<T> {
  cache.scope = scope;

  let request: Promise<T>;
  request = fetcher()
    .then((data) => {
      if (cache.scope === scope && cache.inFlight === request) {
        cache.data = data;
        cache.updatedAt = Date.now();
      }

      return data;
    })
    .finally(() => {
      if (cache.inFlight === request) {
        cache.inFlight = null;
      }
    });

  cache.inFlight = request;
  return request;
}

async function readMercuryResource<T>(
  cache: MercuryResourceCache<T>,
  fetcher: () => Promise<T>,
): Promise<T> {
  const scope = getAppAccessMode();
  prepareMercuryResourceCache(cache, scope);

  const hasData = cache.data !== null;
  const isFresh = hasData && Date.now() - cache.updatedAt < MERCURY_RESOURCE_CACHE_TTL_MS;

  if (isFresh) {
    return cache.data as T;
  }

  if (hasData) {
    if (!cache.inFlight) {
      startMercuryResourceFetch(cache, scope, fetcher).catch(() => undefined);
    }

    return cache.data as T;
  }

  if (cache.inFlight) {
    return cache.inFlight;
  }

  return startMercuryResourceFetch(cache, scope, fetcher);
}

function getMercuryResourceSnapshot<T>(cache: MercuryResourceCache<T>): T | null {
  const scope = getAppAccessMode();
  return cache.scope === scope ? cache.data : null;
}

export function getCachedMercuryAccountsSnapshot(): MercuryAccount[] | null {
  return getMercuryResourceSnapshot(mercuryAccountsCache);
}

export function getCachedMercuryRecipientsSnapshot(): MercuryRecipient[] | null {
  return getMercuryResourceSnapshot(mercuryRecipientsCache);
}

export function invalidateMercuryResourceCache(resource?: MercuryResourceCacheName): void {
  if (!resource || resource === 'accounts') {
    resetMercuryResourceCache(mercuryAccountsCache);
  }

  if (!resource || resource === 'recipients') {
    resetMercuryResourceCache(mercuryRecipientsCache);
  }
}

async function getHostedBearerToken(): Promise<string | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error('Sign in to use Mercury banking features.');
  }

  return data.session?.access_token?.trim() || null;
}

function getMercuryConfig(): MercuryConfig {
  return {
    proxyPath: '/api/mercury',
  };
}

async function mercuryAction<TAction extends MercuryActionName>(
  action: TAction,
  payload?: MercuryActionPayloadMap[TAction],
): Promise<MercuryActionResponseMap[TAction]> {
  const config = getMercuryConfig();
  const accessMode = getAppAccessMode();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (accessMode === 'hosted') {
    const token = await getHostedBearerToken();
    if (!token) {
      throw new Error('Sign in to use Mercury banking features.');
    }

    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(config.proxyPath, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action,
      payload,
      accessMode,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Mercury API request failed (${response.status}): ${text}`);
  }

  return (await response.json()) as MercuryActionResponseMap[TAction];
}

export async function testMercuryConnection(): Promise<{ ok: true; environment: string }> {
  return mercuryAction('testConnection');
}

export async function testMercuryInvoiceAccess(): Promise<{ ok: true; environment: string }> {
  return mercuryAction('testInvoiceAccess');
}

export async function ensureMercuryCustomer(input: {
  name: string;
  email: string;
}): Promise<string> {
  const result = await mercuryAction('ensureCustomer', input);
  return result.customerId;
}

export async function listMercuryAccounts(): Promise<MercuryAccount[]> {
  return readMercuryResource(mercuryAccountsCache, async () => {
    const result = await mercuryAction('listAccounts');
    return result.accounts;
  });
}

export async function createMercuryInvoice(
  payload: MercuryInvoicePayload,
): Promise<MercuryInvoiceResponse> {
  const result = await mercuryAction('createInvoice', payload);
  return result.invoice;
}

export async function listMercuryRecipients(): Promise<MercuryRecipient[]> {
  return readMercuryResource(mercuryRecipientsCache, async () => {
    const result = await mercuryAction('listRecipients');
    return result.recipients;
  });
}

export async function createMercuryRecipient(
  input: MercuryRecord,
): Promise<MercuryRecipient> {
  const result = await mercuryAction('createRecipient', input);
  invalidateMercuryResourceCache('recipients');
  return result.recipient;
}

export async function updateMercuryRecipient(
  recipientId: string,
  input: MercuryRecord,
): Promise<MercuryRecipient> {
  const result = await mercuryAction('updateRecipient', { recipientId, input });
  invalidateMercuryResourceCache('recipients');
  return result.recipient;
}

export async function sendMercuryMoney(
  accountId: string,
  input: MercurySendMoneyInput,
): Promise<MercuryTransaction> {
  const result = await mercuryAction('sendMoney', { accountId, input });
  invalidateMercuryResourceCache('accounts');
  return result.transaction;
}

export type {
  MercuryAccount,
  MercuryInvoicePayload,
  MercuryInvoiceResponse,
  MercuryLineItemPayload,
  MercuryRecipient,
  MercurySendMoneyInput,
  MercurySendEmailOption,
  MercuryTransaction,
} from '@mr.dj2u/mercury';

