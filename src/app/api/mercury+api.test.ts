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

vi.mock('@mrdj/mercury', () => ({
  buildMercuryLineItems: buildMercuryLineItemsMock,
  createMercuryClient: vi.fn(() => ({
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
  })),
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
    process.env.MERCURY_API_KEY = 'test_key';
    process.env.MERCURY_ENVIRONMENT = 'sandbox';
    process.env.MERCURY_BASE_URL = 'https://api-sandbox.mercury.com/api/v1';
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
