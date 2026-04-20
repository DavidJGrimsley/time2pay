import { beforeEach, describe, expect, it, vi } from 'vitest';

const accountsListMock = vi.fn();
const invoiceListMock = vi.fn();
const invoiceCreateMock = vi.fn();
const ensureCustomerMock = vi.fn();
const recipientsListMock = vi.fn();
const recipientCreateMock = vi.fn();
const recipientUpdateMock = vi.fn();
const recipientGetMock = vi.fn();
const sendMoneyMock = vi.fn();
const buildMercuryLineItemsMock = vi.fn((payload) => payload.lineItems ?? []);
const findBestCheckingAccountMock = vi.fn(() => ({ id: 'account_best' }));
const toDayStringMock = vi.fn((input: string) => input.slice(0, 10));
const createMercuryClientMock = vi.fn(() => ({
  accounts: { list: accountsListMock },
  ar: {
    invoices: { list: invoiceListMock, create: invoiceCreateMock },
    customers: { ensureCustomer: ensureCustomerMock },
  },
  recipients: {
    list: recipientsListMock,
    create: recipientCreateMock,
    update: recipientUpdateMock,
    get: recipientGetMock,
  },
  sendMoney: { send: sendMoneyMock },
}));

vi.mock('@mr.dj2u/mercury', () => ({
  buildMercuryLineItems: buildMercuryLineItemsMock,
  createMercuryClient: createMercuryClientMock,
  findBestCheckingAccount: findBestCheckingAccountMock,
  toDayString: toDayStringMock,
}));

describe('/api/mercury POST', () => {
  beforeEach(() => {
    vi.resetModules();
    accountsListMock.mockReset();
    invoiceListMock.mockReset();
    invoiceCreateMock.mockReset();
    ensureCustomerMock.mockReset();
    recipientsListMock.mockReset();
    recipientCreateMock.mockReset();
    recipientUpdateMock.mockReset();
    recipientGetMock.mockReset();
    sendMoneyMock.mockReset();
    buildMercuryLineItemsMock.mockClear();
    findBestCheckingAccountMock.mockClear();
    toDayStringMock.mockClear();
    createMercuryClientMock.mockClear();
    vi.doUnmock('@/server/db/_shared/auth');
    vi.doUnmock('@/server/mercury/credentials');
    process.env.MERCURY_API_KEY = 'test_key';
    process.env.MERCURY_ENVIRONMENT = 'sandbox';
    process.env.MERCURY_BASE_URL = 'https://api-sandbox.mercury.com/api/v1';
    process.env.MERCURY_SANDBOX_API_KEY = '';
    process.env.MERCURY_SANDBOX_BASE_URL = '';
  });

  it('verifies invoice access against Mercury AR', async () => {
    invoiceListMock.mockResolvedValue({ items: [] });
    const { POST } = await import('@/app/api/mercury+api');

    const response = await POST(
      new Request('http://localhost/api/mercury', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'testInvoiceAccess' }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, environment: 'sandbox' });
    expect(invoiceListMock).toHaveBeenCalledWith({ limit: 1 });
  });

  it('uses Mercury sandbox credentials only in tour mode', async () => {
    process.env.MERCURY_SANDBOX_API_KEY = 'sandbox_key';
    process.env.MERCURY_SANDBOX_BASE_URL = 'https://api-sandbox.mercury.com/api/v1';
    accountsListMock.mockResolvedValue({ items: [] });
    const { POST } = await import('@/app/api/mercury+api');

    const response = await POST(
      new Request('http://localhost/api/mercury', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'testConnection', accessMode: 'tour' }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, environment: 'sandbox' });
    expect(createMercuryClientMock).toHaveBeenCalledWith({
      apiKey: 'sandbox_key',
      environment: 'sandbox',
      baseUrl: 'https://api-sandbox.mercury.com/api/v1',
    });
  });

  it('uses the signed-in hosted user Mercury key instead of sandbox credentials', async () => {
    process.env.MERCURY_SANDBOX_API_KEY = 'sandbox_key';
    process.env.MERCURY_BASE_URL = 'https://api.mercury.com/api/v1';
    vi.doMock('@/server/db/_shared/auth', () => ({
      requireAuthUserId: vi.fn().mockResolvedValue('user-1'),
    }));
    vi.doMock('@/server/mercury/credentials', () => ({
      getDecryptedMercuryApiKeyForUser: vi.fn().mockResolvedValue('user_mercury_key'),
    }));
    accountsListMock.mockResolvedValue({ items: [] });
    const { POST } = await import('@/app/api/mercury+api');

    const response = await POST(
      new Request('http://localhost/api/mercury', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer supabase-token',
        },
        body: JSON.stringify({ action: 'testConnection', accessMode: 'hosted' }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, environment: 'production' });
    expect(createMercuryClientMock).toHaveBeenCalledWith({
      apiKey: 'user_mercury_key',
      environment: 'production',
      baseUrl: 'https://api.mercury.com/api/v1',
    });
  });

  it('returns a clear error when signed-in hosted mode has no saved Mercury key', async () => {
    vi.doMock('@/server/db/_shared/auth', () => ({
      requireAuthUserId: vi.fn().mockResolvedValue('user-1'),
    }));
    vi.doMock('@/server/mercury/credentials', () => ({
      getDecryptedMercuryApiKeyForUser: vi.fn().mockResolvedValue(null),
    }));
    const { POST } = await import('@/app/api/mercury+api');

    const response = await POST(
      new Request('http://localhost/api/mercury', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer supabase-token',
        },
        body: JSON.stringify({ action: 'testConnection', accessMode: 'hosted' }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'No Mercury API key is saved for this account.',
    });
    expect(createMercuryClientMock).not.toHaveBeenCalled();
  });

  it('ensures a Mercury customer for client-sync flows', async () => {
    ensureCustomerMock.mockResolvedValue('customer_789');
    const { POST } = await import('@/app/api/mercury+api');

    const response = await POST(
      new Request('http://localhost/api/mercury', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ensureCustomer',
          payload: { name: 'Acme Co', email: 'billing@acme.test' },
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ customerId: 'customer_789' });
    expect(ensureCustomerMock).toHaveBeenCalledWith({
      name: 'Acme Co',
      email: 'billing@acme.test',
    });
  });

  it('creates a recipient through the Mercury proxy route', async () => {
    recipientCreateMock.mockResolvedValue({ id: 'recipient_1', name: 'Studio Ops' });
    const { POST } = await import('@/app/api/mercury+api');

    const response = await POST(
      new Request('http://localhost/api/mercury', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createRecipient',
          payload: { name: 'Studio Ops', emails: ['ops@studio.test'] },
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      recipient: { id: 'recipient_1', name: 'Studio Ops' },
    });
    expect(recipientCreateMock).toHaveBeenCalledWith({
      name: 'Studio Ops',
      emails: ['ops@studio.test'],
    });
  });

  it('resolves paymentMethod from the selected recipient when send money omits it', async () => {
    recipientGetMock.mockResolvedValue({
      id: 'recipient_22',
      name: 'Studio Ops',
      defaultPaymentMethod: 'ach',
    });
    sendMoneyMock.mockResolvedValue({ id: 'txn_55' });
    const { POST } = await import('@/app/api/mercury+api');

    const response = await POST(
      new Request('http://localhost/api/mercury', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sendMoney',
          payload: {
            accountId: 'account_1',
            input: {
              idempotencyKey: 'idem_1',
              recipientId: 'recipient_22',
              amount: 20,
              memo: 'For funnsies',
            },
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ transaction: { id: 'txn_55' } });
    expect(recipientGetMock).toHaveBeenCalledWith('recipient_22');
    expect(sendMoneyMock).toHaveBeenCalledWith('account_1', {
      idempotencyKey: 'idem_1',
      recipientId: 'recipient_22',
      paymentMethod: 'ach',
      amount: 20,
      memo: 'For funnsies',
    });
  });
});
