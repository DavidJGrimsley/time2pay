import { beforeEach, describe, expect, it, vi } from 'vitest';

const createClientMock = vi.fn();
const ensureMercuryCustomerMock = vi.fn();

vi.mock('@/database/db', () => ({
  createClient: createClientMock,
}));

vi.mock('@/services/mercury', () => ({
  ensureMercuryCustomer: ensureMercuryCustomerMock,
}));

describe('createTime2PayClient', () => {
  beforeEach(() => {
    createClientMock.mockReset();
    ensureMercuryCustomerMock.mockReset();
  });

  it('requires a customer email before creating a local record', async () => {
    const { createTime2PayClient } = await import('@/services/client-sync');

    await expect(
      createTime2PayClient({
        id: 'client_1',
        name: 'Acme Co',
        email: null,
        hourly_rate: 125,
      }),
    ).rejects.toThrow('Customer email is required.');

    expect(createClientMock).not.toHaveBeenCalled();
    expect(ensureMercuryCustomerMock).not.toHaveBeenCalled();
  });

  it('syncs the Mercury customer when name and email are present', async () => {
    ensureMercuryCustomerMock.mockResolvedValue('customer_123');
    const { createTime2PayClient } = await import('@/services/client-sync');

    const result = await createTime2PayClient({
      id: 'client_2',
      name: 'Beta Studio',
      email: 'billing@beta.test',
      hourly_rate: 150,
    });

    expect(ensureMercuryCustomerMock).toHaveBeenCalledWith({
      name: 'Beta Studio',
      email: 'billing@beta.test',
    });
    expect(result).toEqual({ mercurySyncStatus: 'synced' });
  });

  it('defers Mercury sync failures instead of breaking local client creation', async () => {
    ensureMercuryCustomerMock.mockRejectedValue(new Error('Mercury request failed (502).'));
    const { createTime2PayClient } = await import('@/services/client-sync');

    const result = await createTime2PayClient({
      id: 'client_3',
      name: 'Gamma Labs',
      email: 'ops@gamma.test',
      hourly_rate: 175,
    });

    expect(createClientMock).toHaveBeenCalled();
    expect(result).toEqual({
      mercurySyncStatus: 'deferred',
      mercuryMessage: 'Mercury request failed (502).',
    });
  });
});
